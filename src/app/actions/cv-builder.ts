"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
import type { AiUsageKind } from "@/lib/ai-usage-limits";
import { getCurrentUser } from "@/lib/auth";
import {
  adaptCvToOffer,
  claudeErrorMessage,
  extractCvForBuilder,
  generateCvSummary,
  improveCvBullet,
  isClaudeConfigured,
  transcribeCv,
  type ImportedCv,
} from "@/lib/claude";
import { CV_HTML_MAX_LENGTH, firstHeadingText, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import {
  CvBuilderError,
  convertImportedCv,
  createBuilderCv,
  createImportedCv,
  deleteBuilderCv,
  finishImportExtraction,
  getBuilderCv,
  getImportState,
  renameBuilderCv,
  saveBuilderCv,
  saveImportedCvHtml,
} from "@/lib/cv-builder";
import {
  CV_IMPORT_FOLDER,
  CV_IMPORT_MAX_BYTES,
  CV_IMPORT_MAX_LABEL,
  CV_LIMITS,
  CvDataSchema,
  dateRange,
  fullName,
  interestList,
  isTemplateId,
  newItemId,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { extractDocxText } from "@/lib/docx";
import { importOfferFromUrl, OfferImportError } from "@/lib/offer-import";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * « Créer un nouveau CV » : CV pré-rempli avec le nom et l'email du compte, dans le modèle
 * choisi (à lier au formulaire : `createBuilderCvAction.bind(null, templateId)`), puis l'éditeur.
 */
export async function createBuilderCvAction(templateId: CvTemplateId) {
  let id: string;
  try {
    const [user, name] = await Promise.all([getCurrentUser(), getAccountName().catch(() => null)]);
    id = await createBuilderCv(
      CvDataSchema.parse({
        personal: { firstName: name?.firstName ?? "", lastName: name?.lastName ?? "", email: user?.email ?? "" },
      }),
      "Mon CV",
      isTemplateId(templateId) ? templateId : "minimaliste",
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


// ---------------------------------------------------------------------------
// « Importer un CV » : PDF ou Word lu par l'IA, puis nouveau CV pré-rempli
// ---------------------------------------------------------------------------

export type ImportCvResult = { ok: true; id: string } | { ok: false; error: string; limitReached?: boolean };

const clip = (value: string, max: number) => value.trim().slice(0, max);

/** Contenu extrait → données du CV, aux bornes du formulaire (un champ trop long est coupé). */
function importedToCvData(cv: ImportedCv): CvData {
  const L = CV_LIMITS;
  const url = (value: string) => clip(value, L.url);
  return CvDataSchema.parse({
    personal: {
      firstName: clip(cv.firstName, 60),
      lastName: clip(cv.lastName, 60),
      jobTitle: clip(cv.jobTitle, L.short),
      email: clip(cv.email, L.short),
      phone: clip(cv.phone, 40),
      city: clip(cv.city, L.short),
      linkedin: url(cv.linkedin),
      website: url(cv.website),
      github: url(cv.github),
    },
    summary: clip(cv.summary, L.text),
    experiences: cv.experiences.slice(0, L.items).map((e) => ({
      id: newItemId(),
      position: clip(e.position, L.short),
      company: clip(e.company, L.short),
      startDate: clip(e.startDate, 40),
      endDate: e.current ? "" : clip(e.endDate, 40),
      current: e.current,
      location: clip(e.location, L.short),
      bullets: e.bullets
        .map((b) => clip(b, L.bullet))
        .filter(Boolean)
        .slice(0, L.bullets),
    })),
    education: cv.education.slice(0, L.items).map((e) => ({
      id: newItemId(),
      school: clip(e.school, L.short),
      degree: clip(e.degree, L.short),
      startDate: clip(e.startDate, 40),
      endDate: clip(e.endDate, 40),
      honors: clip(e.honors, L.short),
    })),
    skills: cv.skills
      .filter((s) => s.name.trim())
      .slice(0, 40)
      .map((s) => ({ id: newItemId(), name: clip(s.name, 80), level: s.level })),
    languages: cv.languages
      .filter((l) => l.name.trim())
      .slice(0, L.items)
      .map((l) => ({ id: newItemId(), name: clip(l.name, 60), level: clip(l.level, 60) })),
    certifications: cv.certifications
      .filter((c) => c.name.trim())
      .slice(0, L.items)
      .map((c) => ({ id: newItemId(), name: clip(c.name, L.short), issuer: clip(c.issuer, L.short), date: clip(c.date, 40) })),
    projects: cv.projects
      .filter((p) => p.name.trim())
      .slice(0, L.items)
      .map((p) => ({ id: newItemId(), name: clip(p.name, L.short), description: clip(p.description, L.text), link: url(p.link) })),
    interests: clip(
      cv.interests
        .map((i) => i.trim())
        .filter(Boolean)
        .join(", "),
      500,
    ),
  });
}

/** Chemin d'un fichier déposé dans le dossier d'import de l'utilisateur, sinon null. */
function importPath(formData: FormData, userId: string | null) {
  const path = formData.get("path");
  if (typeof path !== "string" || !userId) return null;
  const pattern = new RegExp(`^${userId}/${CV_IMPORT_FOLDER}/[A-Za-z0-9-]+\\.(pdf|docx)$`);
  return pattern.test(path) ? path : null;
}

async function removeImport(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("documents").remove([path]);
  if (error) console.error("[cv-builder] suppression de l'import", error.message);
}

/**
 * Lit le fichier importé : déposé par le navigateur dans le stockage privé (`path`, au-delà
 * de la limite de taille des requêtes), ou envoyé avec le formulaire (`file`, mode démo).
 */
async function readImportFile(formData: FormData, userId: string | null): Promise<Buffer | string> {
  if (isSupabaseConfigured()) {
    const path = importPath(formData, userId);
    if (!path) return "Fichier introuvable. Réessaie.";
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("documents").download(path);
    // Supprimé aussitôt lu : le fichier ne sert qu'à l'extraction.
    await removeImport(path);
    if (error || !data) {
      console.error("[cv-builder] lecture de l'import", error?.message);
      return "Le fichier n'a pas pu être lu. Réessaie.";
    }
    return Buffer.from(await data.arrayBuffer());
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choisis ton CV (PDF ou Word).";
  return Buffer.from(await file.arrayBuffer());
}

/** « Importer un CV » : extraction par l'IA puis création du CV pré-rempli. */
export async function importBuilderCvAction(formData: FormData): Promise<ImportCvResult> {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };

  const gate = isClaudeConfigured()
    ? await checkAiAccess("cvb_import")
    : ({ ok: false, message: "L'import n'est pas activé (clé API Claude manquante).", limitReached: false } as const);
  if (!gate.ok) {
    // Le fichier déjà déposé ne sera pas lu : il est supprimé.
    const path = isSupabaseConfigured() ? importPath(formData, user?.id ?? null) : null;
    if (path) await removeImport(path);
    return { ok: false, error: gate.message, limitReached: gate.limitReached };
  }

  const bytes = await readImportFile(formData, user?.id ?? null);
  if (typeof bytes === "string") return { ok: false, error: bytes };
  if (bytes.length > CV_IMPORT_MAX_BYTES) return { ok: false, error: `Ton CV dépasse ${CV_IMPORT_MAX_LABEL}.` };

  // Format reconnu à la signature du fichier, pas seulement à son extension.
  let source: Parameters<typeof extractCvForBuilder>[0];
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    source = { kind: "pdf", base64: bytes.toString("base64") };
  } else if (bytes.subarray(0, 2).toString("latin1") === "PK") {
    const text = extractDocxText(bytes);
    if (!text || text.length < 30) {
      return { ok: false, error: "Ce document Word n'a pas pu être lu. Essaie de l'exporter en PDF." };
    }
    source = { kind: "text", text: text.slice(0, 40_000) };
  } else {
    return { ok: false, error: "Choisis un fichier PDF ou Word (.docx)." };
  }

  // Deux lectures du CV en parallèle : la retranscription en HTML (affichée tout de suite)
  // et l'extraction des données pour les modèles, terminée en arrière-plan après la réponse.
  const extraction = extractCvForBuilder(source).catch((error) => {
    console.error("[cv-builder] extraction", error);
    return null;
  });

  let id: string;
  try {
    const transcribed = await transcribeCv(source.kind === "pdf" ? source.base64 : { text: source.text }, { keepProfile: true });
    if (!transcribed) return { ok: false, error: "Ce CV n'a pas pu être lu. Vérifie le fichier, ou crée ton CV à la main." };
    const html = sanitizeCvHtml(improvedCvToHtml(transcribed));
    await recordAiUsage("cvb_import");
    const name = firstHeadingText(html);
    id = await createImportedCv(name ? `CV ${name}` : "CV importé", html);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    return { ok: false, error: claudeErrorMessage(error, "cv-builder import") };
  }

  const userId = user?.id ?? null;
  after(async () => {
    const extracted = await extraction;
    await finishImportExtraction(id, extracted ? importedToCvData(extracted) : null, userId);
  });
  revalidatePath("/cv-builder");
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// CV importé : modifications du HTML, puis « Convertir en template Applyfy »
// ---------------------------------------------------------------------------

/** Enregistrement de l'éditeur de CV pour un CV importé (même interface que saveImprovedCvAction). */
export async function saveImportedCvAction(id: string, html: string, style?: unknown): Promise<SaveCvResult> {
  if (typeof id !== "string" || typeof html !== "string") return { ok: false, error: "Requête invalide." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: "Le CV est trop long." };
  try {
    const savedAt = await saveImportedCvHtml(id, sanitizeCvHtml(html), style);
    revalidatePath("/cv-builder");
    return { ok: true, savedAt };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    console.error("[cv-builder] enregistrement du CV importé", error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
}

export async function renameBuilderCvAction(id: string, title: string) {
  try {
    await renameBuilderCv(String(id), String(title ?? ""));
    revalidatePath("/cv-builder");
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder] renommage", error);
  }
}

/** Au-delà, une extraction encore « en cours » est considérée comme perdue (fonction interrompue). */
const EXTRACTION_STALE_MS = 3 * 60_000;

export type ImportReadiness = "pending" | "ready" | "missing";

/** L'extraction en arrière-plan est-elle terminée (ou à refaire à la conversion) ? */
export async function importReadinessAction(id: string): Promise<ImportReadiness> {
  const state = await getImportState(String(id)).catch(() => null);
  if (!state) return "missing";
  const stale = Date.now() - new Date(state.createdAt).getTime() > EXTRACTION_STALE_MS;
  return state.status === "pending" && !stale ? "pending" : "ready";
}

/** HTML de l'éditeur → texte (un bloc par ligne), pour une extraction de secours. */
function htmlToText(html: string) {
  return html
    .replace(/<\/(h[1-6]|p|li|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ConvertCvResult = { ok: true } | { ok: false; error: string };

/**
 * « Convertir en template Applyfy » : le CV passe au modèle choisi, pré-rempli avec les
 * données extraites en arrière-plan. Si l'extraction a échoué (ou s'est perdue), ou si le
 * CV a été modifié depuis l'import, elle est refaite à partir du HTML affiché (sans compter
 * une nouvelle utilisation de l'IA).
 */
export async function convertImportedCvAction(id: string, templateId: CvTemplateId): Promise<ConvertCvResult> {
  if (!isTemplateId(templateId)) return { ok: false, error: "Modèle inconnu." };
  try {
    const cv = await getBuilderCv(String(id));
    if (!cv) return { ok: false, error: "Ce CV n'existe plus." };
    if (!cv.imported) return { ok: true }; // déjà converti (autre onglet)

    let data = cv.data;
    if (cv.imported.status !== "ready" || cv.imported.edited) {
      if (!isClaudeConfigured()) return { ok: false, error: "La conversion n'est pas disponible (clé API Claude manquante)." };
      const extracted = await extractCvForBuilder({ kind: "text", text: htmlToText(cv.imported.html).slice(0, 40_000) });
      if (!extracted) return { ok: false, error: "Les informations du CV n'ont pas pu être lues. Réessaie dans un instant." };
      data = importedToCvData(extracted);
    }
    await convertImportedCv(cv.id, templateId, data);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    return { ok: false, error: claudeErrorMessage(error, "cv-builder conversion") };
  }
  revalidatePath("/cv-builder");
  revalidatePath(`/cv-builder/${id}`);
  return { ok: true };
}
