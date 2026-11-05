"use server";

import { refresh } from "next/cache";

import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
import { offerContext } from "@/lib/application-cv";
import {
  getApplicationDetail,
  saveCvSuggestions,
  type ApplicationDetailResult,
} from "@/lib/applications";
import {
  claudeErrorMessage,
  isClaudeConfigured,
  suggestCvAdaptations,
  type OfferContext,
} from "@/lib/claude";
import { readPdfUpload } from "@/lib/cv-file";
import { keywordKey, weighKeywords } from "@/lib/cv-keyword-match";
import { CV_TEXT_MAX_LENGTH, readCvSuggestions, type CvSuggestions } from "@/lib/cv-types";
import { extractPdfText } from "@/lib/pdf-text";
import { getProfileCvFile } from "@/lib/profile";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean }
  | { status: "success"; suggestions: CvSuggestions; generatedAt: string };

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

// ---------------------------------------------------------------------------
// 1. Suggestions d'adaptation
// ---------------------------------------------------------------------------

export async function adaptCvAction(
  _prev: AdaptCvState,
  formData: FormData,
): Promise<AdaptCvState> {
  const prepared = await prepare(formData);
  if (!prepared.ok) return { status: "error", message: prepared.message };

  const gate = await checkAiAccess("adaptation_cv");
  if (!gate.ok) return { status: "error", message: gate.message, limitReached: gate.limitReached };

  // Texte du PDF, lu en même temps que l'analyse : comparé aux mots-clés par le code.
  const cvTextPromise = extractPdfText(Buffer.from(prepared.pdfBase64, "base64")).catch((error) => {
    console.error("[adaptCv] lecture du texte du PDF", error);
    return "";
  });
  let analysis;
  try {
    analysis = await suggestCvAdaptations(prepared.pdfBase64, prepared.offer);
  } catch (error) {
    return { status: "error", message: claudeErrorMessage(error, "adaptCv") };
  }
  if (!analysis) return { status: "error", message: "L'analyse n'a pas pu aboutir pour ce CV." };
  await recordAiUsage("adaptation_cv");

  const { application: app } = prepared.detail;
  const previous = readCvSuggestions(app.cv_suggestions);
  const cvText = (await cvTextPromise).trim().slice(0, CV_TEXT_MAX_LENGTH);
  const suggestions: CvSuggestions = {
    kind: "keywords",
    keywords: weighKeywords(analysis.mots_cles, {
      usefulText: analysis.offre_utile,
      position: app.position,
      company: app.company,
    }),
    // Mots-clés ignorés lors d'une analyse précédente : toujours ignorés s'ils reviennent.
    ignored: previous?.kind === "keywords" ? previous.ignored : [],
    conseils: analysis.conseils.map((c) => c.trim()).filter(Boolean).slice(0, 4),
    titre_cv: analysis.titre_cv.trim().slice(0, 80),
    cvText: cvText || null,
  };

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

/**
 * « Ignorer » / « Rétablir » un mot-clé de l'analyse : retiré du taux de correspondance (ou
 * remis), sans appel à l'IA. Renvoie la liste des mots-clés ignorés enregistrée.
 */
export async function ignoreCvKeywordAction(
  id: string,
  keyword: string,
  ignore: boolean,
): Promise<{ ok: true; ignored: string[] } | { ok: false; error: string }> {
  if (typeof id !== "string" || typeof keyword !== "string" || typeof ignore !== "boolean") {
    return { ok: false, error: "Requête invalide." };
  }
  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const detail = await getApplicationDetail(id);
  const saved = detail ? readCvSuggestions(detail.application.cv_suggestions) : null;
  if (!detail || saved?.kind !== "keywords") return { ok: false, error: "Analyse introuvable. Relance l'analyse." };
  const key = keywordKey(keyword);
  if (!saved.keywords.some((k) => keywordKey(k.keyword) === key)) return { ok: false, error: "Mot-clé introuvable." };

  const others = saved.ignored.filter((k) => keywordKey(k) !== key);
  const ignored = ignore ? [...others, keyword] : others;
  try {
    await saveCvSuggestions(id, { ...saved, ignored }, { keepDate: true });
  } catch (error) {
    console.error("[ignoreCvKeyword]", error);
    return { ok: false, error: "Le changement n'a pas pu être enregistré. Réessaie." };
  }
  return { ok: true, ignored };
}

// ---------------------------------------------------------------------------
// Résultat d'un enregistrement de l'éditeur (lettre de motivation)
// ---------------------------------------------------------------------------

export type SaveCvResult = { ok: true; savedAt: string } | { ok: false; error: string };
