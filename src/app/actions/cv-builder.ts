"use server";

import { createHash } from "node:crypto";

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
  type CoachContext,
  type CoachReply,
  type ImportedCvAnalysis,
  type ImportedCvContent,
} from "@/lib/claude";
import { applyCoachChange, buildProposal, checkProposal, withoutProblems } from "@/lib/coach-proposals";
import {
  CvBuilderError,
  createBuilderCv,
  deleteBuilderCv,
  getBuilderCv,
  saveBuilderCv,
} from "@/lib/cv-builder";
import {
  CV_IMPORT_FOLDER,
  CV_IMPORT_MAX_BYTES,
  CV_IMPORT_MAX_LABEL,
  CV_LIMITS,
  chatContent,
  CvAnalysisSchema,
  CV_CRITERIA,
  CvDataSchema,
  dateRange,
  fullName,
  interestList,
  isTemplateId,
  newItemId,
  type CvAnalysis,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { bannedPhrasesInCv, scoreCv, type CvScore, type ScoringContext } from "@/lib/cv-score";
import { loadScoringContext } from "@/lib/cv-score-context";
import { REFINE_MESSAGE_MAX_LENGTH } from "@/lib/cv-types";
import { matchKeywords } from "@/lib/keyword-match";
import { extractDocxText } from "@/lib/docx";
import { importOfferFromUrl, OfferImportError } from "@/lib/offer-import";
import type { DocumentChatResult } from "@/lib/refine";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { recordUserJobOffer } from "@/lib/user-job-offers";

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

const clip = (value: string, max: number) => value.trim().slice(0, max);

/** Puces regroupées dans un seul élément (« a • b », ou une par ligne) : séparées. */
function splitBullets(bullets: string[]) {
  return bullets.flatMap((b) =>
    b
      .split(/\n+|\s*[•●▪◦►▸]\s*/)
      .map((part) => part.replace(/^[-–—*]\s+/, "").trim())
      .filter(Boolean),
  );
}

const clipList = (items: string[], max: number, count: number) =>
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

/** Contenu extrait → données du CV, aux bornes du formulaire (un champ trop long est coupé). */
function importedToCvData(cv: ImportedCvContent): CvData {
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
      bullets: splitBullets(e.bullets)
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
      .map((s) => ({ id: newItemId(), name: clip(s.name, L.short), level: s.level })),
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
  if (typeof source === "string") return { ok: false, error: source };
  return { ok: true, value: { kind: source.kind === "pdf" ? "pdf" : "docx" } };
}

/**
 * Import, étape « Extraction du CV » : contenu du fichier extrait par l'IA, nouveau CV créé
 * (modèle Minimaliste), essai du mois décompté. Le fichier est ensuite supprimé.
 */
export async function extractCvImportAction(formData: FormData): Promise<ImportStepResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const gate = await importGate();
  if (!gate.ok) return gate;
  const source = await readImportSource(formData, user?.id ?? null);
  if (typeof source === "string") return { ok: false, error: source };
  try {
    const extracted = await extractCvContent(source);
    if (!extracted) return { ok: false, error: "Ce CV n'a pas pu être lu. Vérifie le fichier, ou crée ton CV à la main." };
    const data = importedToCvData(extracted);
    await recordAiUsage("cvb_import");
    const name = fullName(data);
    const id = await createBuilderCv(data, name ? `CV ${name}` : "CV importé");
    // Le fichier ne sert qu'à l'extraction : supprimé dès qu'elle a réussi.
    const path = isSupabaseConfigured() ? importPath(formData, user?.id ?? null) : null;
    if (path) await removeImport(path);
    revalidatePath("/cv-builder");
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
  return cv && { cv, scoring: await loadScoringContext(cv.data) };
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
  const parsed = CvDataSchema.safeParse(rawData);
  if (!parsed.success) return null;
  // Vérifie la connexion ET que le CV appartient bien à l'utilisateur.
  if (!(await getBuilderCv(id))) return null;
  return loadScoringContext(parsed.data);
}

/**
 * Fin de l'import d'un CV existant : poste visé (carte « Quel type de poste tu vises ? ») et
 * modèle choisi. Le coach démarre ensuite de lui-même dans l'éditeur, sur le point qui rapporte
 * le plus (coachOpeningAction).
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
    const data: CvData = { ...cv.data, analysis };
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
const COACH_HISTORY_MAX = 12;

/**
 * Contenu du CV transmis au coach, son empreinte (cache du premier message) et les données du
 * secteur (vérification des modifications). Le coach reçoit à chaque échange la liste à jour
 * des points à corriger : toutes les corrections du score, de la plus rentable à la moins
 * rentable, et les formules à éviter présentes dans le CV.
 */
async function coachContext(data: CvData): Promise<CoachContext & { contentKey: string; scoring: ScoringContext }> {
  const cvJson = JSON.stringify(chatContent(data));
  const a = data.analysis;
  // Score calculé par le code, le même que celui affiché dans l'éditeur.
  const scoring = await loadScoringContext(data);
  const score = scoreCv(data, scoring);
  return {
    scoring,
    cvJson,
    contentKey: createHash("sha256").update(cvJson).digest("hex").slice(0, 32),
    score: {
      value: score.score,
      corrections: score.corrections.map((c) => `${c.message} (+${c.points} pts)`),
      banned: bannedPhrasesInCv(data, scoring).map((b) => `« ${b.phrase} » dans ${b.where}`),
    },
    analysis: a && {
      criteria: Object.fromEntries(CV_CRITERIA.map((c) => [c.label, a.criteria[c.id]])),
      improvements: a.improvements,
      optimizations: a.optimizations.map((o) => o.title),
      targetJob: a.targetJob,
      suggestedJobs: a.suggestedJobs,
    },
  };
}

/**
 * Premier message du coach à l'ouverture de l'éditeur : le point le plus faible du CV et une
 * question. Gratuit (hors quota). Gardé dans le CV tant que son contenu ne change pas.
 */
export async function coachOpeningAction(
  id: string,
): Promise<{ ok: true; coach: NonNullable<CvData["coach"]> } | { ok: false }> {
  if (typeof id !== "string" || !isClaudeConfigured()) return { ok: false };
  try {
    const cv = await getBuilderCv(id);
    if (!cv) return { ok: false };
    const context = await coachContext(cv.data);
    if (cv.data.coach?.contentKey === context.contentKey) return { ok: true, coach: cv.data.coach };

    const rate = await checkAiRateLimit();
    if (!rate.ok) return { ok: false };
    const message = (await coachOpening(context))?.slice(0, 2000);
    if (!message) return { ok: false };
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

/** Question suivante du coach, sans la confirmation « Parfait, j'intègre ça dans ton CV. ». */
function nextCoachQuestion(reply: CoachReply) {
  const question = reply.next_question?.trim();
  if (question) return question;
  return reply.message.replace(/^[^.!?]*\b(int[èe]gre|propos)[^.!?]*[.!?]\s*/i, "").trim();
}

/** Proposition attendue mais incomplète (chiffre manquant) : question ajoutée au message du coach. */
const MISSING_FIGURE_QUESTION =
  "Il me manque un chiffre pour rédiger certaines puces : peux-tu me donner un ordre de grandeur (nombre, %, durée, budget) ?";

/**
 * CV affiché dans l'éditeur (modifications non enregistrées comprises), avec la photo, les
 * réglages et l'analyse enregistrés ; message d'erreur s'il est invalide ou n'est pas à l'utilisateur.
 */
async function readShownCv(id: string, json: string): Promise<CvData | string> {
  if (json.length > 200_000) return "Le CV est trop long.";
  let shown: CvData;
  try {
    const parsed = CvDataSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return "Le CV contient des informations invalides.";
    shown = parsed.data;
  } catch {
    return "Requête invalide.";
  }
  // Vérifie la connexion ET que le CV appartient bien à l'utilisateur.
  const stored = await getBuilderCv(id);
  if (!stored) return "Ce CV n'existe plus.";
  return {
    ...shown,
    personal: { ...shown.personal, photo: stored.data.personal.photo },
    style: stored.data.style,
    analysis: stored.data.analysis,
    coach: null,
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
 * comme adaptation (cvb_chat, 2 par mois avec le plan gratuit) ; les autres comme échanges
 * (cvb_coach, CVB_COACH_DAILY_LIMIT par jour avec le plan gratuit).
 */
export async function refineBuilderCvAction(
  id: string,
  json: string,
  message: string,
  history: unknown,
): Promise<DocumentChatResult> {
  if (typeof id !== "string" || typeof json !== "string" || typeof message !== "string") {
    return { ok: false, error: "Requête invalide." };
  }
  const request = message.trim();
  if (!request) return { ok: false, error: "Écris ta réponse." };
  if (request.length > REFINE_MESSAGE_MAX_LENGTH) return { ok: false, error: "Ton message est trop long." };
  if (!isClaudeConfigured()) return { ok: false, error: "L'assistant n'est pas activé (clé API Claude manquante)." };

  const current = await readShownCv(id, json);
  if (typeof current === "string") return { ok: false, error: current };
  const gate = await coachGate();
  if (!gate.ok) return gate;
  const turns = coachTurns(history);

  let context;
  let reply;
  try {
    context = await coachContext(current);
    reply = await coachBuilderCv(context, turns, request);
  } catch (error) {
    return { ok: false, error: claudeErrorMessage(error, "cv-builder coach") };
  }
  if (!reply) return { ok: false, error: "Le coach n'a pas pu répondre. Reformule ton message." };

  // Adaptations du mois épuisées : pas de proposition, le coach continue avec sa question
  // suivante. L'appel compte comme un échange (cvb_coach).
  if (reply.raw && isLimitReached(gate.chat)) {
    await recordAiUsage("cvb_coach");
    return { ok: true, reply: nextCoachQuestion(reply), html: null, usage: gate.chat, limitNotice: CVB_CHAT_UPDATE_BLOCKED_MESSAGE };
  }

  // Modification vérifiée par le code ; textes refusés (ou contenu invalide) : un nouvel essai,
  // invisible pour le candidat.
  let text = reply.message.trim();
  let proposal = reply.update ? buildProposal(current, reply.update) : null;
  let problems = proposal ? checkProposal(proposal, context.scoring) : [];
  if (reply.raw && (reply.invalid || problems.length)) {
    console.info(`[cv-builder coach] modification refusée (${reply.raw.section}), nouvel essai`, problems);
    const rate = await checkAiRateLimit();
    const retried = rate.ok
      ? await coachBuilderCv(context, turns, request, {
          previous: reply.raw,
          problems: problems.map(({ text, problems }) => ({ text, problems })),
        }).catch((error) => {
          claudeErrorMessage(error, "cv-builder coach : nouvel essai"); // journalisation
          return null;
        })
      : null;
    if (retried) {
      text = retried.message.trim();
      proposal = retried.update ? buildProposal(current, retried.update) : null;
      problems = proposal ? checkProposal(proposal, context.scoring) : [];
    }
  }
  // Textes encore refusés : retirés, jamais écrits dans le CV.
  const incomplete = Boolean(reply.raw) && (!proposal || problems.length > 0);
  if (proposal && problems.length) {
    console.info("[cv-builder coach] textes retirés de la modification", problems);
    proposal = withoutProblems(proposal, problems);
  }
  // Modification appliquée directement, changement par changement (un passage introuvable est ignoré).
  let updated = current;
  let applied = 0;
  for (const change of proposal?.changes ?? []) {
    const next = applyCoachChange(updated, change);
    if (next) {
      updated = next;
      applied++;
    } else console.error("[cv-builder coach] changement inapplicable", change.kind, change.label);
  }
  // Une modification attendue manque (en tout ou partie) : le coach demande le chiffre manquant.
  if ((incomplete || (proposal && !applied)) && !text.endsWith("?")) text = `${text} ${MISSING_FIGURE_QUESTION}`.trim();

  if (applied) {
    await recordAiUsage("cvb_chat");
    return {
      ok: true,
      reply: text,
      html: JSON.stringify(chatContent(updated)),
      usage: { used: gate.chat.used + 1, limit: gate.chat.limit },
    };
  }
  await recordAiUsage("cvb_coach");
  return { ok: true, reply: text, html: null, usage: gate.chat };
}
