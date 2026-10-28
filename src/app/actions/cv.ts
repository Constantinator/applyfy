"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
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
import { blankCvHtml, CV_HTML_MAX_LENGTH, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import { keywordKey, weighKeywords } from "@/lib/cv-keyword-match";
import { readCvStyle } from "@/lib/cv-style";
import { fullName } from "@/lib/person-name";
import { CV_TEXT_MAX_LENGTH, readCvSuggestions, type CvSuggestions } from "@/lib/cv-types";
import { extractPdfText } from "@/lib/pdf-text";
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
// 2. Éditeur de CV de la candidature
// ---------------------------------------------------------------------------

/** PDF (CV du profil ou importé) → HTML de l'éditeur, retranscrit par Claude. */
async function transcribeToHtml(bytes: Buffer): Promise<{ ok: true; html: string } | { ok: false; state: OpenCvEditorState }> {
  if (!isClaudeConfigured()) {
    return { ok: false, state: { status: "error", message: "L'import d'un CV n'est pas disponible sur ce site." } };
  }
  const gate = await checkAiAccess("cv_ameliore");
  if (!gate.ok) {
    return { ok: false, state: { status: "error", message: gate.message, limitReached: gate.limitReached } };
  }
  try {
    const cv = await transcribeCv(bytes.toString("base64"));
    if (!cv) {
      return {
        ok: false,
        state: { status: "error", message: "Ce CV n'a pas pu être lu. Vérifie qu'il s'agit bien d'un PDF de CV." },
      };
    }
    await recordAiUsage("cv_ameliore");
    return { ok: true, html: sanitizeCvHtml(improvedCvToHtml(cv)) };
  } catch (error) {
    return { ok: false, state: { status: "error", message: claudeErrorMessage(error, "transcribeCv") } };
  }
}

/**
 * « Ouvrir l'éditeur de CV » : le CV de la candidature est (re)créé selon le choix, puis
 * l'éditeur s'ouvre.
 *   - actuel : reprendre le CV déjà ouvert pour cette candidature ;
 *   - profil : un CV du profil, retranscrit une seule fois (version mémorisée ensuite) ;
 *   - upload : un PDF importé depuis l'ordinateur, retranscrit ;
 *   - vierge : la structure habituelle avec des exemples à remplacer.
 * Chaque retranscription compte dans la limite « CV ouverts dans l'éditeur ».
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
  const source = String(formData.get("source") ?? "");

  if (source !== "actuel" || !app.cv_improved_html) {
    let html: string;
    if (source === "vierge") {
      const name = await getAccountName().catch(() => null);
      html = sanitizeCvHtml(blankCvHtml(name ? fullName(name) : null));
    } else if (source === "upload") {
      const upload = await readPdfUpload(formData.get("cv"));
      if (!upload.ok) return { status: "error", message: upload.error };
      const result = await transcribeToHtml(upload.bytes);
      if (!result.ok) return result.state;
      html = result.html;
    } else if (source === "profil") {
      const cvId = String(formData.get("cvId") ?? "");
      const cached = await getProfileCvHtml(cvId);
      if (cached) {
        html = cached;
      } else {
        const profileCv = await getProfileCvFile(cvId);
        if (!profileCv) return { status: "error", message: "Ce CV n'existe plus dans ton profil. Choisis-en un autre." };
        const result = await transcribeToHtml(profileCv.bytes);
        if (!result.ok) return result.state;
        html = result.html;
        await saveProfileCvHtml(cvId, html);
      }
    } else {
      return { status: "error", message: "Choisis comment ouvrir l'éditeur." };
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
