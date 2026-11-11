"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { checkAiAccess, checkAiRateLimit, countAiUsageToday, recordAiUsage } from "@/lib/ai-usage";
import {
  CVB_CHAT_UPDATE_BLOCKED_MESSAGE,
  CVB_COACH_DAILY_LIMIT,
  CVB_COACH_DAILY_MESSAGE,
  isLimitReached,
  type AiUsageKind,
} from "@/lib/ai-usage-limits";
import { applicationCvDraft, applicationCvTitle, ensureOfferKeywords } from "@/lib/application-cv";
import { getApplicationDetail, type ApplicationDetailResult } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import {
  adaptCvToOffer,
  claudeErrorMessage,
  extractCvContent,
  analyseCv,
  type CvSource,
  generateCvSummary,
  improveCvBullet,
  isClaudeConfigured,
  coachBuilderCv,
  coachOpening,
  type ImportedCvAnalysis,
} from "@/lib/claude";
import { buildCoachContext, type BuiltCoachContext } from "@/lib/coach-context";
import { listeningState } from "@/lib/coach-intent";
import { boundSkipped, withOfferLanguageNote } from "@/lib/coach-offer";
import { plainCoachText } from "@/lib/coach-plain";
import { closedOpening } from "@/lib/coach-outcome";
import { isCvClosed } from "@/lib/coach-prompt";
import { runCoachTurn } from "@/lib/coach-turn";
import {
  CvBuilderError,
  createBuilderCv,
  deleteBuilderCv,
  getBuilderCv,
  getBuilderCvByApplication,
  linkBuilderCvToApplication,
  saveBuilderCv,
} from "@/lib/cv-builder";
import { clip, importedToCvData } from "@/lib/cv-builder-import";
import {
  CV_IMPORT_FOLDER,
  CV_IMPORT_MAX_BYTES,
  CV_IMPORT_MAX_LABEL,
  CV_UNFIXABLE,
  fitCvData,
  withoutEmptyLines,
  chatContent,
  CvAnalysisSchema,
  CvDataSchema,
  dateRange,
  fullName,
  interestList,
  isTemplateId,
  type CvAnalysis,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { scoreCv, type CvScore, type ScoringContext } from "@/lib/cv-score";
import { loadBuilderCvScoring } from "@/lib/cv-score-context";
import { htmlToText } from "@/lib/cv-html";
import { REFINE_MESSAGE_MAX_LENGTH } from "@/lib/cv-types";
import { matchKeywords } from "@/lib/keyword-match";
import { extractDocxText } from "@/lib/docx";
import { importOfferFromUrl, OfferImportError } from "@/lib/offer-import";
import type { DocumentChatResult } from "@/lib/refine";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { recordUserJobOffer } from "@/lib/user-job-offers";

/** Page du CV Builder où revenir : celle de la candidature si l'action en vient, avec son erreur éventuelle. */
function cvBuilderUrl(applicationId: string, erreur?: string) {
  const params = new URLSearchParams();
  if (applicationId) params.set("applicationId", applicationId);
  if (erreur) params.set("erreur", erreur);
  const query = params.toString();
  return query ? `/cv-builder?${query}` : "/cv-builder";
}

/**
 * « Créer un CV depuis zéro » : CV pré-rempli avec le nom et l'email du compte, dans le modèle
 * choisi (à lier au formulaire : `createBuilderCvAction.bind(null, templateId)`), avec le poste
 * visé du formulaire (champ « targetJob », aussi titre du CV), puis l'éditeur. Champ
 * « applicationId » : CV lié à cette candidature, et mots-clés de son offre générés.
 */
export async function createBuilderCvAction(templateId: CvTemplateId, formData?: FormData) {
  let id: string;
  const targetJob = String(formData?.get("targetJob") ?? "").trim().slice(0, 120);
  const applicationId = String(formData?.get("applicationId") ?? "");
  try {
    // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
    const detail = applicationId ? await getApplicationDetail(applicationId) : null;
    if (applicationId && !detail) redirect("/cv-builder?erreur=creation");
    const [user, name] = await Promise.all([
      getCurrentUser(),
      getAccountName().catch(() => null),
      detail ? ensureOfferKeywords(detail) : null,
    ]);
    id = await createBuilderCv(
      CvDataSchema.parse({
        personal: {
          firstName: name?.firstName ?? "",
          lastName: name?.lastName ?? "",
          email: user?.email ?? "",
          jobTitle: targetJob,
        },
        targetJob,
        origin: "scratch",
      }),
      detail ? applicationCvTitle(name, detail.application.company) : "Mon CV",
      isTemplateId(templateId) ? templateId : "minimaliste",
    );
    if (detail) await linkOrDiscard(id, applicationId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) redirect(cvBuilderUrl(applicationId, "limite"));
    console.error("[cv-builder] création", error);
    redirect(cvBuilderUrl(applicationId, "creation"));
  }
  revalidatePath("/cv-builder");
  if (applicationId) revalidatePath(`/candidatures/${applicationId}`);
  redirect(`/cv-builder/${id}`);
}

/**
 * « Utiliser pour cette offre » : copie d'un CV de l'utilisateur, dans son modèle, liée à la candidature,
 * avec son poste pour poste visé et le nom du CV d'une candidature, puis l'éditeur. L'original n'est ni
 * modifié ni lié ; le CV déjà lié à la candidature est seulement détaché. Sans décompte : aucune IA sur le CV.
 */
export async function copyCvForOfferAction(formData: FormData) {
  const cvId = String(formData.get("cvId") ?? "");
  const applicationId = String(formData.get("applicationId") ?? "");
  let id: string;
  try {
    // Vérifient la connexion ET que la candidature et le CV appartiennent bien à l'utilisateur.
    const detail = applicationId ? await getApplicationDetail(applicationId) : null;
    if (!detail) redirect(cvBuilderUrl("", "creation"));
    const source = await getBuilderCv(cvId);
    if (!source) redirect(cvBuilderUrl(applicationId, "creation"));
    // Double envoi ou page périmée : ce CV est déjà celui de la candidature.
    if (source.applicationId === applicationId) redirect(cvBuilderUrl(applicationId));
    await ensureOfferKeywords(detail);
    // Sans le premier message du coach : il sera écrit pour ce CV et cette offre.
    id = await createApplicationCv({ ...source.data, coach: null }, detail, source.templateId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) redirect(cvBuilderUrl(applicationId, "limite"));
    console.error("[cv-builder] copie pour une offre", error);
    redirect(cvBuilderUrl(applicationId, "creation"));
  }
  revalidatePath("/cv-builder");
  revalidatePath(`/candidatures/${applicationId}`);
  redirect(`/cv-builder/${id}`);
}

/** Lie un nouveau CV à sa candidature ; en cas d'échec, le CV sans lien ne reste pas dans la liste. */
async function linkOrDiscard(id: string, applicationId: string) {
  try {
    await linkBuilderCvToApplication(id, applicationId);
  } catch (error) {
    await deleteBuilderCv(id).catch((e) => console.error("[cv-builder] suppression", e));
    throw error;
  }
}

/**
 * « Reprendre mon ancien CV » : CV de l'ancien éditeur d'une candidature, converti par l'IA en CV
 * du CV Builder lié à cette candidature, sans décompte (le changement d'éditeur ne se paie pas ;
 * seule la limite anti-rafale s'applique). L'ancien CV reste en base.
 */
export async function convertLegacyCvAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const back = `/cv-builder?applicationId=${encodeURIComponent(applicationId)}`;
  let id: string;
  try {
    // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
    const detail = applicationId ? await getApplicationDetail(applicationId) : null;
    if (!detail) redirect("/cv-builder?erreur=creation");
    // Double envoi : le CV déjà converti apparaît en tête de la page de retour.
    if (await getBuilderCvByApplication(applicationId)) redirect(back);
    const text = htmlToText(detail.application.cv_improved_html);
    const rate = isClaudeConfigured() ? await checkAiRateLimit() : null;
    if (!text || !rate?.ok) redirect(`${back}&erreur=conversion`);
    const [extracted] = await Promise.all([
      extractCvContent({ kind: "text", text: text.slice(0, 40_000) }),
      ensureOfferKeywords(detail),
    ]);
    if (!extracted) redirect(`${back}&erreur=conversion`);
    id = await createApplicationCv(importedToCvData(extracted), detail);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) redirect(`${back}&erreur=limite`);
    claudeErrorMessage(error, "cv-builder : conversion de l'ancien CV"); // journalisation
    redirect(`${back}&erreur=conversion`);
  }
  revalidatePath("/cv-builder");
  revalidatePath(`/candidatures/${applicationId}`);
  redirect(`/cv-builder/${id}`);
}

/** `notice` : le CV est enregistré, mais un champ refusé a été corrigé (cf. fitCvData). */
export type SaveCvResult = { ok: true; savedAt: string; notice?: string } | { ok: false; error: string };

/**
 * CV reçu de l'éditeur, toujours valide : un champ refusé est corrigé, sans bloquer le reste du CV, et
 * journalisé (son chemin, pas son contenu). `notice` : message pour l'utilisateur, qui le nomme.
 */
function fittedCv(raw: unknown, context: string) {
  const { data, fixes } = fitCvData(raw);
  if (fixes.length) console.error(`[cv-builder] CV corrigé (${context}) : champ ${fixes[0].path || "racine"}, ${fixes.length} correction(s), ${fixes[0].code}`);
  return { data, notice: fixes[0]?.message, unfixable: fixes.some((f) => f.code === CV_UNFIXABLE) };
}

/** Sauvegarde automatique de l'éditeur. */
export async function saveBuilderCvAction(
  id: string,
  input: { title: string; templateId: CvTemplateId; data: CvData },
): Promise<SaveCvResult> {
  if (!isTemplateId(input?.templateId)) return { ok: false, error: "Modèle inconnu." };
  // Pas de contenu : surtout ne pas enregistrer un CV vide à la place du CV.
  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) return { ok: false, error: "Requête invalide." };
  const { data, notice, unfixable } = fittedCv(input.data, "enregistrement");
  if (unfixable) return { ok: false, error: notice ?? "Requête invalide." };
  try {
    const savedAt = await saveBuilderCv(String(id), {
      title: String(input.title ?? ""),
      templateId: input.templateId,
      data,
    });
    revalidatePath("/cv-builder");
    return notice ? { ok: true, savedAt, notice } : { ok: true, savedAt };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    console.error("[cv-builder] enregistrement", error);
    return { ok: false, error: "L'enregistrement a échoué. Nouvel essai à la prochaine modification." };
  }
}

/** Suppression d'un CV, puis retour à la page d'où elle vient (champ « applicationId » : celle de la candidature). */
export async function deleteBuilderCvAction(id: string, formData?: FormData) {
  const applicationId = String(formData?.get("applicationId") ?? "");
  try {
    await deleteBuilderCv(String(id));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder] suppression", error);
    redirect(cvBuilderUrl(applicationId, "suppression"));
  }
  revalidatePath("/cv-builder");
  if (applicationId) revalidatePath(`/candidatures/${applicationId}`);
  redirect(cvBuilderUrl(applicationId));
}

// ---------------------------------------------------------------------------
// IA : un essai gratuit par mois et par fonctionnalité, sans quota mensuel en Premium
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
  const { data } = fittedCv(rawData, "résumé");
  if (!data.experiences.length && !data.education.length && !data.skills.length) {
    return { ok: false, error: "Ajoute d'abord une expérience, une formation ou des compétences." } satisfies AiResult<string>;
  }
  return runAi("cvb_resume", "cv-builder résumé", () => generateCvSummary(cvToText(data)));
}

export type AdaptedExperiences = { experiences: { id: string; bullets: string[] }[]; keywords: string[] };

/** « Adapter à une offre » : `offer` est l'adresse de l'offre ou son texte collé. */
export async function adaptToOfferAction(rawData: CvData, offer: string) {
  const experiences = fittedCv(rawData, "adaptation").data.experiences
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
      recordUserJobOffer({ title: imported.position, company: imported.company, description: imported.description });
    } else {
      // Texte collé : la première ligne tient lieu d'intitulé.
      recordUserJobOffer({ title: input.split("\n")[0].slice(0, 120), company: null, description: input });
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

const clipList =(items: string[], max: number, count: number) =>
  items
    .map((item) => clip(item, max))
    .filter(Boolean)
    .slice(0, count);

/** Note de l'IA ramenée à un entier entre 0 et `max`. */
const clampNote = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)));

/** Analyse de l'IA aux bornes du schéma ; null si elle est inutilisable (le CV reste importé). */
function importedAnalysis(a: ImportedCvAnalysis | null): CvAnalysis | null {
  if (!a) return null;
  const parsed = CvAnalysisSchema.safeParse({
    score: clampNote(a.score, 100),
    criteria: Object.fromEntries(Object.entries(a.criteria).map(([k, v]) => [k, clampNote(v, 10)])),
    positives: clipList(a.positives, 300, 6),
    improvements: clipList(a.improvements, 300, 6),
    optimizations: a.optimizations
      .map((o) => ({ title: clip(o.title, 200), detail: clip(o.detail, 500), request: clip(o.request, 200) }))
      .filter((o) => o.title)
      .slice(0, 5),
    suggestedJobs: clipList(a.suggestedJobs, 80, 5),
    targetJob: "",
  });
  if (!parsed.success) console.error("[cv-builder] analyse de l'import", parsed.error.message);
  return parsed.success ? parsed.data : null;
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
    // Gardé après la lecture : l'étape d'extraction le relit, puis le supprime une fois réussie.
    const { data, error } = await supabase.storage.from("documents").download(path);
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

/** Résultat d'une étape de l'import : sa valeur, ou l'erreur à afficher (bouton Réessayer). */
export type ImportStepResult<T> = { ok: true; value: T } | { ok: false; error: string; limitReached?: boolean };

/** Vérifications avant une étape de l'IA : clé API, essai du mois (cvb_import), anti-rafale. */
async function importGate(): Promise<ImportStepResult<null>> {
  if (!isClaudeConfigured()) return { ok: false, error: "L'import n'est pas activé (clé API Claude manquante)." };
  const gate = await checkAiAccess("cvb_import");
  return gate.ok ? { ok: true, value: null } : { ok: false, error: gate.message, limitReached: gate.limitReached };
}

/** Fichier de l'import lu et reconnu (PDF, ou texte d'un .docx) ; sinon le message d'erreur. */
async function readImportSource(formData: FormData, userId: string | null): Promise<CvSource | string> {
  const bytes = await readImportFile(formData, userId);
  if (typeof bytes === "string") return bytes;
  if (bytes.length > CV_IMPORT_MAX_BYTES) return `Ton CV dépasse ${CV_IMPORT_MAX_LABEL}.`;

  // Fichier reçu identique à celui choisi : même taille que celle annoncée par le navigateur.
  const expectedSize = Number(formData.get("size"));
  if (expectedSize && expectedSize !== bytes.length) {
    console.error(`[cv-builder] import : taille reçue ${bytes.length} ≠ taille envoyée ${expectedSize}`);
    return "Le fichier a été mal transmis. Réessaie.";
  }
  // Format reconnu à la signature du fichier, pas seulement à son extension.
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return { kind: "pdf", base64: bytes.toString("base64") };
  if (bytes.subarray(0, 2).toString("latin1") === "PK") {
    const text = extractDocxText(bytes);
    if (!text || text.length < 30) return "Ce document Word n'a pas pu être lu. Essaie de l'exporter en PDF.";
    return { kind: "text", text: text.slice(0, 40_000) };
  }
  return "Choisis un fichier PDF ou Word (.docx).";
}

/**
 * Import, étape « Lecture du fichier » : fichier déposé par le navigateur, lu et reconnu, et essai
 * du mois disponible. Le fichier est gardé pour l'extraction.
 */
export async function checkCvImportAction(formData: FormData): Promise<ImportStepResult<{ kind: "pdf" | "docx" }>> {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const gate = await importGate();
  if (!gate.ok) return gate;
  const source = await readImportSource(formData, user?.id ?? null);
  if (typeof source === "string") {
    // Fichier refusé : il ne reste pas dans le stockage (l'utilisateur en choisira un autre).
    const path = isSupabaseConfigured() ? importPath(formData, user?.id ?? null) : null;
    if (path) await removeImport(path);
    return { ok: false, error: source };
  }
  return { ok: true, value: { kind: source.kind === "pdf" ? "pdf" : "docx" } };
}

/**
 * Crée le CV d'une candidature à partir d'un CV extrait par l'IA, avec le poste de la candidature
 * pour poste visé (à défaut, celui du CV), et le lie à cette candidature.
 */
async function createApplicationCv(data: CvData, detail: ApplicationDetailResult, templateId?: CvTemplateId): Promise<string> {
  const applicationId = detail.application.id;
  const draft = applicationCvDraft(data, detail.application, await getAccountName().catch(() => null));
  const id = await createBuilderCv(draft.data, draft.title, templateId);
  await linkOrDiscard(id, applicationId);
  return id;
}

/**
 * Import, étape « Extraction du CV » : contenu du fichier extrait par l'IA, nouveau CV créé
 * (modèle Minimaliste), essai du mois décompté. Le fichier est ensuite supprimé. Champ
 * « applicationId » : CV lié à cette candidature, et mots-clés de son offre générés.
 */
export async function extractCvImportAction(formData: FormData): Promise<ImportStepResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const gate = await importGate();
  if (!gate.ok) return gate;
  const source = await readImportSource(formData, user?.id ?? null);
  if (typeof source === "string") return { ok: false, error: source };
  try {
    // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
    const applicationId = String(formData.get("applicationId") ?? "");
    const detail = applicationId ? await getApplicationDetail(applicationId) : null;
    if (applicationId && !detail) return { ok: false, error: "Cette candidature n'existe plus." };
    const [extracted] = await Promise.all([extractCvContent(source), detail ? ensureOfferKeywords(detail) : null]);
    if (!extracted) return { ok: false, error: "Ce CV n'a pas pu être lu. Vérifie le fichier, ou crée ton CV à la main." };
    const data = importedToCvData(extracted);
    const name = fullName(data);
    const id = detail ? await createApplicationCv(data, detail) : await createBuilderCv(data, name ? `CV ${name}` : "CV importé");
    // Décompté une fois le CV créé : un import refusé (limite de CV) ne coûte pas l'essai du mois.
    await recordAiUsage("cvb_import");
    // Le fichier ne sert qu'à l'extraction : supprimé dès qu'elle a réussi.
    const path = isSupabaseConfigured() ? importPath(formData, user?.id ?? null) : null;
    if (path) await removeImport(path);
    revalidatePath("/cv-builder");
    if (detail) revalidatePath(`/candidatures/${applicationId}`);
    return { ok: true, value: { id } };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { ok: false, error: error.message };
    return { ok: false, error: claudeErrorMessage(error, "cv-builder import") };
  }
}

/** CV de l'utilisateur et données de son secteur (étapes de l'import qui suivent l'extraction). */
async function importedCv(id: unknown) {
  const cv = typeof id === "string" ? await getBuilderCv(id) : null;
  return cv && { cv, scoring: await loadBuilderCvScoring(cv.data, cv.applicationId) };
}

const IMPORT_NOT_FOUND = { ok: false as const, error: "Ce CV n'existe plus. Recommence l'import." };

/** Import, étape « Détection de ton secteur et du poste visé ». */
export async function detectCvTargetAction(id: string): Promise<ImportStepResult<{ sector: string; jobTitle: string }>> {
  try {
    const found = await importedCv(id);
    if (!found) return IMPORT_NOT_FOUND;
    const { data } = found.cv;
    const jobTitle = data.personal.jobTitle.trim() || data.experiences[0]?.position.trim() || "";
    return { ok: true, value: { sector: found.scoring.sectorName, jobTitle } };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder import] secteur", error);
    return { ok: false, error: "Le secteur n'a pas pu être détecté. Réessaie." };
  }
}

/**
 * Import, étape « Comparaison avec les offres du marché » : mots-clés les plus fréquents des
 * offres récentes du secteur (job_keywords), et ceux que le CV contient déjà.
 */
export async function compareCvMarketAction(id: string): Promise<ImportStepResult<{ found: number; total: number }>> {
  try {
    const found = await importedCv(id);
    if (!found) return IMPORT_NOT_FOUND;
    const { scoring, cv } = found;
    const present = matchKeywords(JSON.stringify(chatContent(cv.data)), scoring.marketKeywords, scoring.sector);
    return { ok: true, value: { found: present.length, total: scoring.marketKeywords.length } };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder import] marché", error);
    return { ok: false, error: "La comparaison avec les offres n'a pas abouti. Réessaie." };
  }
}

/** Import, étape « Notation du CV » : score calculé par le code (cv-score.ts), le même que dans l'éditeur. */
export async function scoreCvImportAction(id: string): Promise<ImportStepResult<CvScore>> {
  try {
    const found = await importedCv(id);
    if (!found) return IMPORT_NOT_FOUND;
    return { ok: true, value: scoreCv(found.cv.data, found.scoring) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder import] score", error);
    return { ok: false, error: "La notation n'a pas abouti. Réessaie." };
  }
}

/**
 * Import, étape « Génération de conseils personnalisés » : analyse du CV extrait (JSON) par l'IA,
 * avec le secteur et les mots-clés du marché ; enregistrée avec le CV. Comprise dans l'import.
 */
export async function analyseCvImportAction(id: string): Promise<ImportStepResult<CvAnalysis | null>> {
  if (!isClaudeConfigured()) return { ok: false, error: "L'import n'est pas activé (clé API Claude manquante)." };
  try {
    const found = await importedCv(id);
    if (!found) return IMPORT_NOT_FOUND;
    const { cv, scoring } = found;
    const rate = await checkAiRateLimit();
    if (!rate.ok) return { ok: false, error: rate.message };
    const raw = await analyseCv(JSON.stringify(chatContent(cv.data)), {
      name: scoring.sectorName,
      marketKeywords: scoring.marketKeywords,
    });
    const analysis = importedAnalysis(raw);
    if (!analysis) return { ok: false, error: "Les conseils n'ont pas pu être générés. Réessaie." };
    await saveBuilderCv(cv.id, { title: cv.title, templateId: cv.templateId, data: { ...cv.data, analysis } });
    return { ok: true, value: analysis };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: claudeErrorMessage(error, "cv-builder import : conseils") };
  }
}

/**
 * Contexte du score recalculé quand le poste cible change dans l'éditeur (titre du CV ou poste
 * visé) : le secteur détecté peut changer. Contenu affiché, revalidé ; CV de l'utilisateur.
 */
export async function scoringContextAction(id: string, rawData: unknown): Promise<ScoringContext | null> {
  if (typeof id !== "string") return null;
  const { data } = fittedCv(rawData, "score");
  // Vérifie la connexion ET que le CV appartient bien à l'utilisateur. Lien à la candidature relu
  // en base (jamais envoyé par le navigateur) : même secteur que le score de la page.
  const stored = await getBuilderCv(id);
  if (!stored) return null;
  return loadBuilderCvScoring(data, stored.applicationId);
}

/**
 * Fin de l'import d'un CV existant : poste visé (carte « Quel type de poste tu vises ? ») et
 * modèle choisi. Le coach démarre ensuite de lui-même dans l'éditeur, sur le premier point dans
 * son ordre de traitement (coachOpeningAction).
 */
export async function completeCvImportAction(
  id: string,
  input: { templateId: CvTemplateId; targetJob: string },
): Promise<{ ok: boolean }> {
  const templateId = isTemplateId(input?.templateId) ? input.templateId : "minimaliste";
  const targetJob = String(input?.targetJob ?? "").trim().slice(0, 120);
  try {
    const cv = await getBuilderCv(String(id));
    if (!cv) return { ok: false };
    const analysis = cv.data.analysis && { ...cv.data.analysis, targetJob };
    const data: CvData = { ...cv.data, analysis, targetJob };
    await saveBuilderCv(cv.id, { title: cv.title, templateId, data });
    revalidatePath("/cv-builder");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cv-builder] fin de l'import", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Chat « coach » de l'éditeur (même composant que le CV d'une candidature)
// ---------------------------------------------------------------------------

/** Échanges précédents transmis au coach (un coaching s'étale sur plusieurs messages). */
const COACH_HISTORY_MAX = 30;

/**
 * Contexte du coach (coach-context.ts) : la candidature liée est relue une seule fois, avec les
 * droits de l'utilisateur, pour le secteur du score et les mots-clés de l'offre.
 */
async function coachContext(
  data: CvData,
  applicationId: string | null,
  request: string | null = null,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<BuiltCoachContext> {
  const detail = applicationId ? await getApplicationDetail(applicationId) : null;
  // Score calculé par le code, le même que celui affiché dans l'éditeur (secteur de l'offre pour un CV lié).
  const scoring = await loadBuilderCvScoring(data, applicationId, detail);
  return buildCoachContext(data, scoring, detail, request, history);
}

/**
 * Premier message du coach à l'ouverture de l'éditeur : le premier point dans son ordre de
 * traitement et une question. Gratuit (hors quota). Gardé dans le CV tant que son contenu ne change pas.
 */
export async function coachOpeningAction(
  id: string,
): Promise<{ ok: true; coach: NonNullable<CvData["coach"]> } | { ok: false }> {
  if (typeof id !== "string" || !isClaudeConfigured()) return { ok: false };
  try {
    const cv = await getBuilderCv(id);
    if (!cv) return { ok: false };
    const context = await coachContext(cv.data, cv.applicationId);
    if (cv.data.coach?.contentKey === context.contentKey) return { ok: true, coach: cv.data.coach };

    // CV clos : texte fixe écrit par le serveur, sans appel au modèle (aucune question de parcours).
    let message: string | undefined;
    if (isCvClosed(context.score.value)) message = closedOpening(context.score.value, context.language);
    else {
      const rate = await checkAiRateLimit();
      if (!rate.ok) return { ok: false };
      message = (await coachOpening(context))?.slice(0, 2000);
    }
    if (!message) return { ok: false };
    // CV lié : offre et CV dans deux langues différentes, signalé une fois par le serveur.
    message = withOfferLanguageNote(plainCoachText(message, context.language), context);
    const coach = { opening: message, contentKey: context.contentKey };
    await saveBuilderCv(cv.id, { title: cv.title, templateId: cv.templateId, data: { ...cv.data, coach } });
    return { ok: true, coach };
  } catch (error) {
    unstable_rethrow(error);
    claudeErrorMessage(error, "cv-builder coach : premier message"); // journalisation
    return { ok: false };
  }
}

/**
 * Accès au coach : échanges du jour (cvb_coach, CVB_COACH_DAILY_LIMIT avec le plan gratuit),
 * indépendants des adaptations du mois. `chat` : adaptations du mois (cvb_chat), nécessaires
 * seulement pour appliquer une modification du CV.
 */
async function coachGate() {
  const gate = await checkAiAccess("cvb_coach");
  if (!gate.ok) return { ok: false as const, error: gate.message, limitReached: false };
  if (!gate.usage.premium && (await countAiUsageToday("cvb_coach")) >= CVB_COACH_DAILY_LIMIT) {
    return { ok: false as const, error: CVB_COACH_DAILY_MESSAGE, limitReached: false };
  }
  return { ok: true as const, chat: gate.usage.counts.cvb_chat };
}

/**
 * Points abandonnés pendant la session, renvoyés par l'éditeur : revalidés et bornés (les
 * marqueurs des étapes de l'offre, coach-offer.ts, sont gardés à part).
 */
const SKIPPED_MAX = 50;
function skippedPoints(value: unknown): string[] {
  return Array.isArray(value)
    ? boundSkipped(
        value.filter((p): p is string => typeof p === "string" && p.trim() !== ""),
        SKIPPED_MAX,
      ).map((p) => p.trim().slice(0, 200))
    : [];
}

/**
 * CV affiché dans l'éditeur (modifications non enregistrées comprises), avec la photo, les réglages et
 * l'analyse enregistrés ; `notice` si un champ refusé a été corrigé ; message d'erreur s'il est
 * illisible ou n'est pas à l'utilisateur.
 */
async function readShownCv(id: string, json: string): Promise<{ data: CvData; applicationId: string | null; notice?: string } | string> {
  if (json.length > 200_000) return "Le CV est trop long.";
  let shown: CvData;
  let notice: string | undefined;
  try {
    const fitted = fittedCv(JSON.parse(json), "coach");
    if (fitted.unfixable) return fitted.notice ?? "Requête invalide.";
    notice = fitted.notice;
    // Le coach désigne les puces par leur position dans le contenu qu'il a reçu (chatContent) :
    // ses modifications s'appliquent sur le même contenu, sans lignes vides.
    shown = withoutEmptyLines(fitted.data);
  } catch {
    return "Requête invalide.";
  }
  // Vérifie la connexion ET que le CV appartient bien à l'utilisateur.
  const stored = await getBuilderCv(id);
  if (!stored) return "Ce CV n'existe plus.";
  return {
    applicationId: stored.applicationId,
    notice,
    data: {
      ...shown,
      personal: { ...shown.personal, photo: stored.data.personal.photo },
      style: stored.data.style,
      analysis: stored.data.analysis,
      // Hors du contenu envoyé par l'éditeur (chatContent) : le poste visé guide le coach et le score.
      targetJob: stored.data.targetJob,
      origin: stored.data.origin,
      coach: null,
    },
  };
}

/** Échanges précédents du chat, revalidés et limités aux plus récents. */
function coachTurns(history: unknown) {
  return Array.isArray(history)
    ? history
        .filter(
          (t): t is { role: "user" | "assistant"; content: string } =>
            Boolean(t) && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
        )
        .slice(-COACH_HISTORY_MAX)
        .map(({ role, content }) => ({ role, content: content.slice(0, 2000) }))
    : [];
}

/**
 * Réponse du coach au message du candidat, sur le CV affiché (modifications non enregistrées
 * comprises). Le coach mène : il pose ses questions, puis modifie directement le CV ; chaque
 * nouvelle puce est vérifiée par le code avant d'être écrite. `json` : contenu du CV
 * (chatContent) ; le CV mis à jour est renvoyé au même format dans `html` (nom imposé par le
 * composant du chat), ou null s'il ne change pas. Quota : une réponse qui modifie le CV compte
 * comme adaptation (cvb_chat, 2 par mois avec le plan gratuit) ; les autres, et celles qui ne font
 * que réorganiser le contenu, comme échanges (cvb_coach, CVB_COACH_DAILY_LIMIT par jour avec le plan gratuit).
 */
export async function refineBuilderCvAction(
  id: string,
  json: string,
  message: string,
  history: unknown,
  skipped: unknown = [],
): Promise<DocumentChatResult> {
  if (typeof id !== "string" || typeof json !== "string" || typeof message !== "string") {
    return { ok: false, error: "Requête invalide." };
  }
  const request = message.trim();
  if (!request) return { ok: false, error: "Écris ta réponse." };
  if (request.length > REFINE_MESSAGE_MAX_LENGTH) return { ok: false, error: "Ton message est trop long." };
  if (!isClaudeConfigured()) return { ok: false, error: "L'assistant n'est pas activé (clé API Claude manquante)." };

  const shown = await readShownCv(id, json);
  if (typeof shown === "string") return { ok: false, error: shown };
  const current = shown.data;
  const gate = await coachGate();
  if (!gate.ok) return gate;
  const turns = coachTurns(history);

  let context: BuiltCoachContext;
  let reply;
  try {
    const built = await coachContext(current, shown.applicationId, request, turns);
    context = {
      ...built,
      skipped: skippedPoints(skipped),
      // CV lié : mots-clés de l'offre encore absents (arrêt des questions après deux refus).
      listening: listeningState(turns, request, built.offerSteps ? { keywords: built.offerKeywords ?? [] } : undefined),
    };
    reply = await coachBuilderCv(context, turns, request);
  } catch (error) {
    return { ok: false, error: claudeErrorMessage(error, "cv-builder coach") };
  }
  if (!reply) return { ok: false, error: "Le coach n'a pas pu répondre. Reformule ton message." };

  const limitReached = isLimitReached(gate.chat);
  // Vérification, second essai (contrôle de débit compris), application et texte : coach-turn.ts.
  const turn = await runCoachTurn({
    current,
    context,
    turns,
    request,
    reply,
    limitReached,
    retry: async (retry) => {
      const rate = await checkAiRateLimit();
      return rate.ok
        ? await coachBuilderCv(context, turns, request, retry).catch((error) => {
            claudeErrorMessage(error, "cv-builder coach : nouvel essai"); // journalisation
            return null;
          })
        : null;
    },
  });

  // Adaptations du mois épuisées : pas de modification, le coach continue avec sa question.
  // L'appel compte comme un échange (cvb_coach).
  if (turn.kind === "quotaBlocked") {
    await recordAiUsage("cvb_coach");
    return {
      ok: true,
      reply: turn.text,
      html: null,
      usage: gate.chat,
      limitNotice: CVB_CHAT_UPDATE_BLOCKED_MESSAGE,
      skippedPoints: turn.skippedPoints,
    };
  }

  if (turn.applied) {
    await recordAiUsage(turn.reorganized ? "cvb_coach" : "cvb_chat");
    return {
      ok: true,
      reply: shown.notice ? `${shown.notice} ${turn.text}` : turn.text,
      html: JSON.stringify(chatContent(turn.updated)),
      usage: turn.reorganized ? gate.chat : { used: gate.chat.used + 1, limit: gate.chat.limit },
      skippedPoints: turn.skippedPoints,
    };
  }
  await recordAiUsage("cvb_coach");
  return { ok: true, reply: turn.text, html: null, usage: gate.chat, skippedPoints: turn.skippedPoints };
}
