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
  isClaudeConfigured,
  suggestCvAdaptations,
  transcribeCv,
  type OfferContext,
} from "@/lib/claude";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import { readCvStyle } from "@/lib/cv-style";
import type { CvSuggestions } from "@/lib/cv-types";
import { getProfileCvFile, getProfileCvHtml, saveProfileCvHtml } from "@/lib/profile";
import { refineApplicationDocument, type RefineResult } from "@/lib/refine";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean }
  | { status: "success"; suggestions: CvSuggestions; generatedAt: string };

export type OpenCvEditorState =
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
// 2. Éditeur de CV de la candidature
// ---------------------------------------------------------------------------

/**
 * « Ouvrir l'éditeur de CV » : ouvre le CV de la candidature, ou le crée à partir d'un CV
 * du profil. Le PDF n'est retranscrit qu'une fois par CV du profil (version mémorisée
 * ensuite) ; chaque retranscription compte dans la limite « CV ouverts dans l'éditeur ».
 */
export async function openCvEditorAction(
  _prev: OpenCvEditorState,
  formData: FormData,
): Promise<OpenCvEditorState> {
  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const id = String(formData.get("id") ?? "");
  const detail = id ? await getApplicationDetail(id) : null;
  if (!detail) return { status: "error", message: "Candidature introuvable." };
  const app = detail.application;

  if (!app.cv_improved_html) {
    const cvId = String(formData.get("cvId") ?? "");
    let html = await getProfileCvHtml(cvId);
    if (!html) {
      if (!isClaudeConfigured()) {
        return { status: "error", message: "L'ouverture d'un CV dans l'éditeur n'est pas disponible sur ce site." };
      }
      if (isLimitReached(await getAiUsageFor("cv_ameliore"))) {
        return { status: "error", message: LIMIT_REACHED_MESSAGE, limitReached: true };
      }
      const profileCv = await getProfileCvFile(cvId);
      if (!profileCv) return { status: "error", message: "Ce CV n'existe plus dans ton profil. Choisis-en un autre." };
      try {
        const cv = await transcribeCv(profileCv.bytes.toString("base64"));
        if (!cv) return { status: "error", message: "Ce CV n'a pas pu être lu. Vérifie qu'il s'agit bien d'un PDF de CV." };
        html = sanitizeCvHtml(improvedCvToHtml(cv));
      } catch (error) {
        return { status: "error", message: claudeErrorMessage(error, "transcribeCv") };
      }
      await recordAiUsage("cv_ameliore");
      await saveProfileCvHtml(cvId, html);
    }

    try {
      await saveImprovedCv(app.id, html);
    } catch (error) {
      unstable_rethrow(error);
      console.error("[openCvEditor] enregistrement", error);
      return { status: "error", message: "Le CV n'a pas pu être ouvert. Réessaie dans un instant." };
    }
    revalidatePath(`/candidatures/${app.id}`);
  }

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
