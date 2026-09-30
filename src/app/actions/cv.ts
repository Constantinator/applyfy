"use server";

import Anthropic from "@anthropic-ai/sdk";

import { getApplicationDetail, saveCvSuggestions } from "@/lib/applications";
import { isClaudeConfigured, suggestCvAdaptations } from "@/lib/claude";
import { CV_MAX_BYTES, CV_MAX_LABEL, type CvSuggestions } from "@/lib/cv-types";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; suggestions: CvSuggestions; generatedAt: string };

export async function adaptCvAction(
  _prev: AdaptCvState,
  formData: FormData,
): Promise<AdaptCvState> {
  if (!isClaudeConfigured()) {
    return { status: "error", message: "L'adaptation de CV n'est pas activée (clé API Claude manquante)." };
  }

  // Charge la candidature via la couche de données : vérifie la connexion ET que
  // la candidature appartient bien à l'utilisateur.
  const id = String(formData.get("id") ?? "");
  const detail = id ? await getApplicationDetail(id) : null;
  if (!detail) return { status: "error", message: "Candidature introuvable." };

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choisis ton CV au format PDF." };
  }
  if (file.size > CV_MAX_BYTES) {
    return { status: "error", message: `Ton CV dépasse ${CV_MAX_LABEL}. Exporte-le en PDF plus léger.` };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  // Vérifie la signature du fichier, pas seulement son extension.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { status: "error", message: "Ce fichier n'est pas un PDF valide." };
  }

  const { application: app } = detail;
  let suggestions: CvSuggestions | null;
  try {
    suggestions = await suggestCvAdaptations(bytes.toString("base64"), {
      position: app.position,
      company: app.company,
      location: app.location,
      summary: app.offer_summary ?? null,
      description: app.offer_description,
    });
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) {
      console.error("[adaptCv] requête refusée", error.message);
      return {
        status: "error",
        message: "Impossible de lire ce PDF (protégé par mot de passe ou endommagé ?).",
      };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { status: "error", message: "Trop de demandes en ce moment. Réessaie dans une minute." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[adaptCv] API ${error.status}`, error.message);
      return { status: "error", message: "Le service d'analyse est indisponible. Réessaie plus tard." };
    }
    console.error("[adaptCv]", error);
    return { status: "error", message: "L'analyse de ton CV a échoué. Réessaie dans un instant." };
  }

  if (!suggestions) {
    return { status: "error", message: "L'analyse n'a pas pu aboutir pour ce CV." };
  }

  const generatedAt = new Date().toISOString();
  try {
    await saveCvSuggestions(app.id, suggestions);
  } catch (error) {
    // Non bloquant : l'utilisateur voit quand même ses suggestions (ex. migration 0005 absente).
    console.error("[adaptCv] enregistrement des suggestions", error);
  }

  return { status: "success", suggestions, generatedAt };
}
