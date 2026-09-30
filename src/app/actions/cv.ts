"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  getApplicationDetail,
  saveCvSuggestions,
  saveImprovedCv,
  type ApplicationDetailResult,
} from "@/lib/applications";
import { generateImprovedCv, isClaudeConfigured, suggestCvAdaptations, type OfferContext } from "@/lib/claude";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import { readCvSuggestions, type CvSuggestions } from "@/lib/cv-types";
import { getProfileCvFile } from "@/lib/profile";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; suggestions: CvSuggestions; generatedAt: string };

export type GenerateCvState = { status: "idle" } | { status: "error"; message: string };

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

  const app = detail.application;
  return {
    ok: true,
    detail,
    pdfBase64: bytes.toString("base64"),
    offer: {
      position: app.position,
      company: app.company,
      location: app.location,
      summary: app.offer_summary ?? null,
      description: app.offer_description,
    },
  };
}

function claudeErrorMessage(error: unknown, context: string): string {
  if (error instanceof Anthropic.BadRequestError) {
    console.error(`[${context}] requête refusée`, error.message);
    return "Impossible de lire ce PDF (protégé par mot de passe ou endommagé ?).";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Trop de demandes en ce moment. Réessaie dans une minute.";
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`[${context}] API ${error.status}`, error.message);
    return "Le service d'analyse est indisponible. Réessaie plus tard.";
  }
  console.error(`[${context}]`, error);
  return "L'opération a échoué. Réessaie dans un instant.";
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

  let suggestions: CvSuggestions | null;
  try {
    suggestions = await suggestCvAdaptations(prepared.pdfBase64, prepared.offer);
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "adaptCv") };
  }
  if (!suggestions) return { status: "error", message: "L'analyse n'a pas pu aboutir pour ce CV." };

  const generatedAt = new Date().toISOString();
  try {
    await saveCvSuggestions(prepared.detail.application.id, suggestions);
  } catch (error) {
    // Non bloquant : l'utilisateur voit quand même ses suggestions.
    console.error("[adaptCv] enregistrement des suggestions", error);
  }
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

  let html: string;
  try {
    const improved = await generateImprovedCv(prepared.pdfBase64, prepared.offer, suggestions);
    if (!improved) return { status: "error", message: "Le CV amélioré n'a pas pu être généré." };
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

export async function saveImprovedCvAction(id: string, html: string): Promise<SaveCvResult> {
  if (typeof id !== "string" || typeof html !== "string") return { ok: false, error: "Requête invalide." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: "Le CV est trop long." };

  // getApplicationDetail vérifie la connexion et la propriété de la candidature.
  const detail = await getApplicationDetail(id);
  if (!detail) return { ok: false, error: "Candidature introuvable." };

  try {
    await saveImprovedCv(id, sanitizeCvHtml(html));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[saveImprovedCv]", error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  return { ok: true, savedAt: new Date().toISOString() };
}
