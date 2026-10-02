"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAiUsageFor, recordAiUsage } from "@/lib/ai-usage";
import { isLimitReached, LIMIT_REACHED_MESSAGE } from "@/lib/ai-usage-limits";
import {
  getApplicationDetail,
  saveCvSuggestions,
  saveImprovedCv,
  type ApplicationDetailResult,
} from "@/lib/applications";
import {
  claudeErrorMessage,
  generateImprovedCv,
  isClaudeConfigured,
  suggestCvAdaptations,
  type OfferContext,
} from "@/lib/claude";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import { readCvStyle } from "@/lib/cv-style";
import { readCvSuggestions, type CvSuggestions } from "@/lib/cv-types";
import { getProfileCvFile } from "@/lib/profile";
import { refineApplicationDocument, type RefineResult } from "@/lib/refine";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean }
  | { status: "success"; suggestions: CvSuggestions; generatedAt: string };

export type GenerateCvState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean };

type Prepared =
  | { ok: true; detail: ApplicationDetailResult; pdfBase64: string; offer: OfferContext }
  | { ok: false; message: string };

/**
 * Étapes communes : Claude activé, candidature de l'utilisateur, CV à analyser
 * (celui du profil ou un PDF envoyé avec le formulaire).
 */
async function prepare(formData: FormData): Promise<Prepared> {
  if (!isClaudeConfigured()) {
    return { ok: false, message: "L'adaptation de CV n'est pas activée (clé API Claude manquante)." };
  }

  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const id = String(formData.get("id") ?? "");
  const detail = id ? await getApplicationDetail(id) : null;
  if (!detail) return { ok: false, message: "Candidature introuvable." };

  let bytes: Buffer;
  if (formData.get("source") === "profil") {
    // Un CV du profil, désigné par son id (propriété vérifiée par getProfileCvFile).
    const profileCv = await getProfileCvFile(String(formData.get("cvId") ?? ""));
    if (!profileCv) {
      return { ok: false, message: "Ce CV n'existe plus dans ton profil. Choisis-en un autre." };
    }
    bytes = profileCv.bytes;
  } else {
    const upload = await readPdfUpload(formData.get("cv"));
    if (!upload.ok) return { ok: false, message: upload.error };
    bytes = upload.bytes;
  }

  return { ok: true, detail, pdfBase64: bytes.toString("base64"), offer: offerContext(detail) };
}

function offerContext({ application: app }: ApplicationDetailResult): OfferContext {
  return {
    position: app.position,
    company: app.company,
    location: app.location,
    summary: app.offer_summary ?? null,
    description: app.offer_description,
  };
}

// ---------------------------------------------------------------------------
// 1. Suggestions d'adaptation
// ---------------------------------------------------------------------------

export async function adaptCvAction(
  _prev: AdaptCvState,
  formData: FormData,
): Promise<AdaptCvState> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return { status: "error", message: prepared.message };

  if (isLimitReached(await getAiUsageFor("adaptation_cv"))) {
    return { status: "error", message: LIMIT_REACHED_MESSAGE, limitReached: true };
  }

  let suggestions: CvSuggestions | null;
  try {
    suggestions = await suggestCvAdaptations(prepared.pdfBase64, prepared.offer);
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "adaptCv") };
  }
  if (!suggestions) return { status: "error", message: "L'analyse n'a pas pu aboutir pour ce CV." };
  await recordAiUsage("adaptation_cv");

  const generatedAt = new Date().toISOString();
  try {
    await saveCvSuggestions(prepared.detail.application.id, suggestions);
  } catch (error) {
    // Non bloquant : l'utilisateur voit quand même ses suggestions.
    console.error("[adaptCv] enregistrement des suggestions", error);
  }
  refresh(); // compteur d'adaptations à jour dans la page
  return { status: "success", suggestions, generatedAt };
}

// ---------------------------------------------------------------------------
// 2. CV complet amélioré
// ---------------------------------------------------------------------------

export async function generateImprovedCvAction(
  _prev: GenerateCvState,
  formData: FormData,
): Promise<GenerateCvState> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return { status: "error", message: prepared.message };

  const app = prepared.detail.application;
  const suggestions = readCvSuggestions(app.cv_suggestions);
  if (!suggestions) {
    return { status: "error", message: "Lance d'abord l'analyse de ton CV pour cette offre." };
  }
  // Génération et regénération comptent toutes deux dans la limite mensuelle.
  if (isLimitReached(await getAiUsageFor("cv_ameliore"))) {
    return { status: "error", message: LIMIT_REACHED_MESSAGE, limitReached: true };
  }

  let html: string;
  try {
    const improved = await generateImprovedCv(prepared.pdfBase64, prepared.offer, suggestions);
    if (!improved) return { status: "error", message: "Le CV amélioré n'a pas pu être généré." };
    await recordAiUsage("cv_ameliore");
    html = sanitizeCvHtml(improvedCvToHtml(improved));
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "generateImprovedCv") };
  }

  try {
    await saveImprovedCv(app.id, html);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[generateImprovedCv] enregistrement", error);
    return { status: "error", message: "Le CV a été généré mais n'a pas pu être enregistré." };
  }

  revalidatePath(`/candidatures/${app.id}`);
  redirect(`/candidatures/${app.id}/cv`);
}

// ---------------------------------------------------------------------------
// 3. Enregistrement des modifications faites dans l'éditeur
// ---------------------------------------------------------------------------

export type SaveCvResult = { ok: true; savedAt: string } | { ok: false; error: string };

export async function saveImprovedCvAction(
  id: string,
  html: string,
  style?: unknown,
): Promise<SaveCvResult> {
  if (typeof id !== "string" || typeof html !== "string") return { ok: false, error: "Requête invalide." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: "Le CV est trop long." };

  // getApplicationDetail vérifie la connexion et la propriété de la candidature.
  const detail = await getApplicationDetail(id);
  if (!detail) return { ok: false, error: "Candidature introuvable." };

  try {
    // Style revalidé côté serveur : toute valeur inconnue revient à sa valeur par défaut.
    await saveImprovedCv(id, sanitizeCvHtml(html), style === undefined ? undefined : readCvStyle(style));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[saveImprovedCv]", error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  return { ok: true, savedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// 4. Affinage du CV par chat (« Affiner avec l'IA »), cf. lib/refine
// ---------------------------------------------------------------------------

export async function refineCvAction(
  id: string,
  html: string,
  message: string,
  history: unknown,
): Promise<RefineResult> {
  return refineApplicationDocument("cv", id, html, message, history);
}
