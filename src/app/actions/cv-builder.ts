"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
import type { AiUsageKind } from "@/lib/ai-usage-limits";
import { getCurrentUser } from "@/lib/auth";
import { adaptCvToOffer, claudeErrorMessage, generateCvSummary, improveCvBullet, isClaudeConfigured } from "@/lib/claude";
import {
  CvBuilderError,
  createBuilderCv,
  deleteBuilderCv,
  saveBuilderCv,
} from "@/lib/cv-builder";
import {
  CvDataSchema,
  dateRange,
  fullName,
  interestList,
  isTemplateId,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { importOfferFromUrl, OfferImportError } from "@/lib/offer-import";

/** « Créer un CV » : nouveau CV pré-rempli avec le nom et l'email du compte, puis l'éditeur. */
export async function createBuilderCvAction() {
  let id: string;
  try {
    const [user, name] = await Promise.all([getCurrentUser(), getAccountName().catch(() => null)]);
    id = await createBuilderCv(
      CvDataSchema.parse({
        personal: { firstName: name?.firstName ?? "", lastName: name?.lastName ?? "", email: user?.email ?? "" },
      }),
    );
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) redirect("/cv-builder?erreur=limite");
    console.error("[cv-builder] création", error);
    redirect("/cv-builder?erreur=creation");
  }
  revalidatePath("/cv-builder");
  redirect(`/cv-builder/${id}`);
}

export type SaveCvResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Sauvegarde automatique de l'éditeur. */
export async function saveBuilderCvAction(
  id: string,
  input: { title: string; templateId: CvTemplateId; data: CvData },
): Promise<SaveCvResult> {
  if (!isTemplateId(input?.templateId)) return { ok: false, error: "Modèle inconnu." };
  const parsed = CvDataSchema.safeParse(input.data);
  if (!parsed.success) return { ok: false, error: "Certaines informations sont trop longues pour être enregistrées." };
  try {
    const savedAt = await saveBuilderCv(String(id), {
      title: String(input.title ?? ""),
      templateId: input.templateId,
      data: parsed.data,
    });
    revalidatePath("/cv-builder");
    return { ok: true, savedAt };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    console.error("[cv-builder] enregistrement", error);
    return { ok: false, error: "L'enregistrement a échoué. Nouvel essai à la prochaine modification." };
  }
}

export async function deleteBuilderCvAction(id: string) {
  try {
    await deleteBuilderCv(String(id));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder] suppression", error);
    redirect("/cv-builder?erreur=suppression");
  }
  revalidatePath("/cv-builder");
  redirect("/cv-builder");
}

// ---------------------------------------------------------------------------
// IA : un essai gratuit par mois et par fonctionnalité, illimité en Premium
// ---------------------------------------------------------------------------

export type AiResult<T> = { ok: true; value: T } | { ok: false; error: string; limitReached?: boolean };

/** Vérification d'accès, appel à Claude, puis comptage de l'utilisation si l'appel a réussi. */
async function runAi<T>(kind: AiUsageKind, context: string, call: () => Promise<T | null>): Promise<AiResult<T>> {
  if (!isClaudeConfigured()) return { ok: false, error: "L'IA n'est pas activée (clé API Claude manquante)." };
  const gate = await checkAiAccess(kind);
  if (!gate.ok) return { ok: false, error: gate.message, limitReached: gate.limitReached };
  try {
    const value = await call();
    if (value === null) return { ok: false, error: "L'IA n'a pas pu répondre. Réessaie dans un instant." };
    await recordAiUsage(kind);
    return { ok: true, value };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof OfferImportError) {
      return { ok: false, error: `${error.message} Colle plutôt le texte de l'offre.` };
    }
    return { ok: false, error: claudeErrorMessage(error, context) };
  }
}

/** « Améliorer avec l'IA » sur un point d'expérience. */
export async function improveBulletAction(input: { bullet: string; position: string; company: string }) {
  const bullet = String(input?.bullet ?? "").trim().slice(0, 500);
  if (!bullet) return { ok: false, error: "Écris d'abord ce point d'expérience." } satisfies AiResult<string>;
  return runAi("cvb_puce", "cv-builder puce", () =>
    improveCvBullet({
      bullet,
      position: String(input.position ?? "").slice(0, 120),
      company: String(input.company ?? "").slice(0, 120),
    }),
  );
}

/** Texte du CV transmis à Claude pour le résumé de profil. */
function cvToText(data: CvData) {
  const lines = [
    `Nom : ${fullName(data) || "non renseigné"}`,
    data.personal.jobTitle ? `Poste visé : ${data.personal.jobTitle}` : null,
    "",
    "Expériences :",
    ...data.experiences.flatMap((e) => [
      `- ${e.position} — ${e.company} (${dateRange(e.startDate, e.endDate, e.current) || "dates non précisées"})`,
      ...e.bullets.filter((b) => b.trim()).map((b) => `  • ${b}`),
    ]),
    "",
    "Formation :",
    ...data.education.map((e) => `- ${e.degree} — ${e.school} (${dateRange(e.startDate, e.endDate)})`),
    data.skills.length ? `\nCompétences : ${data.skills.map((s) => s.name).filter(Boolean).join(", ")}` : null,
    data.languages.length ? `Langues : ${data.languages.map((l) => `${l.name} ${l.level}`.trim()).join(", ")}` : null,
    data.projects.length ? `Projets : ${data.projects.map((p) => p.name).filter(Boolean).join(", ")}` : null,
    interestList(data).length ? `Centres d'intérêt : ${interestList(data).join(", ")}` : null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** « Générer un résumé » de la section Profil. */
export async function generateSummaryAction(rawData: CvData) {
  const parsed = CvDataSchema.safeParse(rawData);
  if (!parsed.success) return { ok: false, error: "Le CV contient des informations invalides." } satisfies AiResult<string>;
  const data = parsed.data;
  if (!data.experiences.length && !data.education.length && !data.skills.length) {
    return { ok: false, error: "Ajoute d'abord une expérience, une formation ou des compétences." } satisfies AiResult<string>;
  }
  return runAi("cvb_resume", "cv-builder résumé", () => generateCvSummary(cvToText(data)));
}

export type AdaptedExperiences = { experiences: { id: string; bullets: string[] }[]; keywords: string[] };

/** « Adapter à une offre » : `offer` est l'adresse de l'offre ou son texte collé. */
export async function adaptToOfferAction(rawData: CvData, offer: string) {
  const parsed = CvDataSchema.safeParse(rawData);
  if (!parsed.success) return { ok: false, error: "Le CV contient des informations invalides." } satisfies AiResult<AdaptedExperiences>;
  const experiences = parsed.data.experiences
    .map((e) => ({
      id: e.id,
      heading: `${e.position} — ${e.company}`,
      bullets: e.bullets.filter((b) => b.trim()),
    }))
    .filter((e) => e.bullets.length);
  if (!experiences.length) {
    return { ok: false, error: "Ajoute d'abord des points à tes expériences." } satisfies AiResult<AdaptedExperiences>;
  }
  const input = String(offer ?? "").trim().slice(0, 30_000);
  if (input.length < 20) return { ok: false, error: "Colle l'adresse ou le texte de l'offre." } satisfies AiResult<AdaptedExperiences>;

  return runAi<AdaptedExperiences>("cvb_adaptation", "cv-builder adaptation", async () => {
    let offerText = input;
    if (/^https?:\/\/\S+$/i.test(input)) {
      const imported = await importOfferFromUrl(input);
      offerText = [`Poste : ${imported.position}`, `Entreprise : ${imported.company}`, imported.description].join("\n");
    }
    const result = await adaptCvToOffer(experiences, offerText);
    if (!result) return null;
    // Seules les expériences du CV, avec le même nombre de points, sont reprises.
    const known = new Map(experiences.map((e) => [e.id, e.bullets.length]));
    return {
      experiences: result.experiences.filter((e) => known.get(e.id) === e.bullets.length),
      keywords: result.keywords.slice(0, 8),
    };
  });
}

