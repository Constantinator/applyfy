"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { checkAiAccess, checkAiRateLimit, recordAiUsage } from "@/lib/ai-usage";
import {
  getApplicationDetail,
  saveCvSuggestions,
  type ApplicationDetailResult,
} from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import {
  claudeErrorMessage,
  extractCvContent,
  isClaudeConfigured,
  suggestCvAdaptations,
  type CvSource,
  type OfferContext,
} from "@/lib/claude";
import {
  assertBuilderCvRoom,
  createBuilderCv,
  CvBuilderError,
  deleteBuilderCv,
  getBuilderCvByApplication,
  linkBuilderCvToApplication,
} from "@/lib/cv-builder";
import { importedToCvData } from "@/lib/cv-builder-import";
import { CvDataSchema, type CvData } from "@/lib/cv-builder-types";
import { readPdfUpload } from "@/lib/cv-file";
import { htmlToText } from "@/lib/cv-html";
import { keywordKey, weighKeywords } from "@/lib/cv-keyword-match";
import { CV_TEXT_MAX_LENGTH, readCvSuggestions, type CvSuggestions } from "@/lib/cv-types";
import { extractPdfText } from "@/lib/pdf-text";
import { getProfileCvData, getProfileCvFile, getProfileCvHtml, saveProfileCvData } from "@/lib/profile";

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
// 2. CV de la candidature, ouvert dans le CV Builder
// ---------------------------------------------------------------------------

/** Résultat d'une étape de l'ouverture : la valeur, ou l'état d'erreur à afficher. */
type OpenStep<T> = { ok: true; value: T } | { ok: false; state: OpenCvEditorState };

const openError = (message: string, limitReached?: boolean): { ok: false; state: OpenCvEditorState } => ({
  ok: false,
  state: { status: "error", message, limitReached },
});

/**
 * Contenu d'un CV extrait par Claude. `charge` : compte dans la limite « CV ouverts dans
 * l'éditeur ». Sans décompte (ancien CV déjà payé), seule la limite anti-rafale s'applique.
 */
async function extractForBuilder(source: CvSource, charge: boolean): Promise<OpenStep<CvData>> {
  if (!isClaudeConfigured()) return openError("L'import d'un CV n'est pas disponible sur ce site.");
  const gate = charge ? await checkAiAccess("cv_ameliore") : await checkAiRateLimit();
  if (!gate.ok) return openError(gate.message, charge && gate.limitReached);
  try {
    const extracted = await extractCvContent(source);
    if (!extracted) return openError("Ce CV n'a pas pu être lu. Vérifie qu'il s'agit bien d'un PDF de CV.");
    if (charge) await recordAiUsage("cv_ameliore");
    return { ok: true, value: importedToCvData(extracted) };
  } catch (error) {
    unstable_rethrow(error);
    return openError(claudeErrorMessage(error, "openCvEditor"));
  }
}

/** Contenu du nouveau CV selon le choix de la fenêtre (toutes les sources sauf le CV déjà lié). */
async function builderDataFor(
  source: string,
  formData: FormData,
  app: ApplicationDetailResult["application"],
): Promise<OpenStep<CvData>> {
  if (source === "vierge") {
    const [user, name] = await Promise.all([getCurrentUser(), getAccountName().catch(() => null)]);
    return {
      ok: true,
      value: CvDataSchema.parse({
        personal: { firstName: name?.firstName ?? "", lastName: name?.lastName ?? "", email: user?.email ?? "" },
        origin: "scratch",
      }),
    };
  }
  if (source === "upload") {
    const upload = await readPdfUpload(formData.get("cv"));
    if (!upload.ok) return openError(upload.error);
    return extractForBuilder({ kind: "pdf", base64: upload.bytes.toString("base64") }, true);
  }
  if (source === "profil") {
    const cvId = String(formData.get("cvId") ?? "");
    const cached = await getProfileCvData(cvId);
    if (cached) return { ok: true, value: cached };
    const profileCv = await getProfileCvFile(cvId);
    if (!profileCv) return openError("Ce CV n'existe plus dans ton profil. Choisis-en un autre.");
    // Déjà retranscrit pour l'ancien éditeur : l'ouverture ne se paie pas une seconde fois.
    const alreadyPaid = Boolean(await getProfileCvHtml(cvId));
    const result = await extractForBuilder({ kind: "pdf", base64: profileCv.bytes.toString("base64") }, !alreadyPaid);
    if (result.ok) await saveProfileCvData(cvId, result.value);
    return result;
  }
  if (source === "actuel") {
    // CV de l'ancien éditeur, converti une seule fois : le changement d'éditeur ne se paie pas.
    const text = htmlToText(app.cv_improved_html);
    if (text) return extractForBuilder({ kind: "text", text: text.slice(0, 40_000) }, false);
  }
  return openError("Choisis comment ouvrir l'éditeur.");
}

/**
 * « Ouvrir l'éditeur de CV » : le CV s'ouvre dans le CV Builder, lié à la candidature.
 *   - actuel : le CV déjà lié, sinon celui de l'ancien éditeur (converti une seule fois) ;
 *   - profil : un CV du profil, extrait une seule fois (version mémorisée ensuite) ;
 *   - upload : un PDF importé depuis l'ordinateur ;
 *   - vierge : un CV vide, avec le nom et l'email du compte.
 * Chaque extraction compte dans la limite « CV ouverts dans l'éditeur ». Un nouveau CV prend la
 * place de l'ancien sur la candidature, qui reste dans le CV Builder.
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

  let builderId: string;
  try {
    const linked = source === "actuel" ? await getBuilderCvByApplication(app.id) : null;
    if (linked) {
      builderId = linked.id;
    } else {
      // Avant l'appel à l'IA : pas d'attente ni de quota perdus si la limite de CV est atteinte.
      await assertBuilderCvRoom();
      const result = await builderDataFor(source, formData, app);
      if (!result.ok) return result.state;
      const data = result.value;
      const targetJob = app.position.trim().slice(0, 120);
      const jobTitle = data.personal.jobTitle.trim() || targetJob;
      builderId = await createBuilderCv(
        { ...data, targetJob, personal: { ...data.personal, jobTitle } },
        `CV ${app.position} - ${app.company}`,
      );
      try {
        await linkBuilderCvToApplication(builderId, app.id);
      } catch (error) {
        // CV déjà lié encore en place : le nouveau CV, sans lien, ne reste pas dans la liste.
        await deleteBuilderCv(builderId).catch((e) => console.error("[openCvEditor] suppression", e));
        throw error;
      }
      revalidatePath(`/candidatures/${app.id}`);
      revalidatePath("/cv-builder");
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof CvBuilderError) return { status: "error", message: error.message };
    console.error("[openCvEditor]", error);
    return { status: "error", message: "Le CV n'a pas pu être ouvert. Réessaie dans un instant." };
  }

  redirect(`/cv-builder/${builderId}`);
}

// ---------------------------------------------------------------------------
// Résultat d'un enregistrement de l'éditeur (lettre de motivation)
// ---------------------------------------------------------------------------

export type SaveCvResult = { ok: true; savedAt: string } | { ok: false; error: string };
