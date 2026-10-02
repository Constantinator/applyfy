"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { getAiUsageFor, recordAiUsage } from "@/lib/ai-usage";
import { isLimitReached, limitReachedMessage, type AiUsageCount } from "@/lib/ai-usage-limits";
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
  refineCv,
  suggestCvAdaptations,
  type OfferContext,
  type RefineChatTurn,
} from "@/lib/claude";
import { readPdfUpload } from "@/lib/cv-file";
import { CV_HTML_MAX_LENGTH, improvedCvToHtml, sanitizeCvHtml } from "@/lib/cv-html";
import { readCvStyle } from "@/lib/cv-style";
import { readCvSuggestions, REFINE_MESSAGE_MAX_LENGTH, type CvSuggestions } from "@/lib/cv-types";
import { getProfileCvFile } from "@/lib/profile";

export type AdaptCvState =
  | { status: "idle" }
  | { status: "error"; message: string; limitReached?: boolean }
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

  // Seule l'analyse compte comme une adaptation : le CV amélioré en découle.
  if (isLimitReached(await getAiUsageFor("adaptation_cv"))) {
    return { status: "error", message: limitReachedMessage("adaptation_cv"), limitReached: true };
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
// 4. Affinage du CV par chat (« Affiner avec l'IA »)
// ---------------------------------------------------------------------------

/** Nombre d'échanges précédents transmis à Claude comme contexte. */
const REFINE_HISTORY_MAX = 6;

export type RefineCvResult =
  | { ok: true; reply: string; html: string; usage: AiUsageCount }
  | { ok: false; error: string; limitReached?: boolean };

function readHistory(raw: unknown): RefineChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (turn): turn is RefineChatTurn =>
        Boolean(turn) &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    )
    .slice(-REFINE_HISTORY_MAX)
    .map(({ role, content }) => ({ role, content: content.slice(0, REFINE_MESSAGE_MAX_LENGTH) }));
}

/**
 * Applique une demande du candidat au CV affiché dans l'éditeur (modifications non
 * enregistrées comprises). Le CV n'est pas enregistré : l'éditeur affiche le résultat,
 * que le candidat garde (Enregistrer) ou annule. Chaque demande compte comme une
 * adaptation de CV dans le quota mensuel.
 */
export async function refineCvAction(
  id: string,
  html: string,
  message: string,
  history: unknown,
): Promise<RefineCvResult> {
  if (typeof id !== "string" || typeof html !== "string" || typeof message !== "string") {
    return { ok: false, error: "Requête invalide." };
  }
  const request = message.trim();
  if (!request) return { ok: false, error: "Écris ta demande." };
  if (request.length > REFINE_MESSAGE_MAX_LENGTH) return { ok: false, error: "Ta demande est trop longue." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: "Le CV est trop long." };
  if (!isClaudeConfigured()) {
    return { ok: false, error: "L'assistant n'est pas activé (clé API Claude manquante)." };
  }

  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const detail = await getApplicationDetail(id);
  if (!detail) return { ok: false, error: "Candidature introuvable." };

  const usage = await getAiUsageFor("adaptation_cv");
  if (isLimitReached(usage)) {
    return { ok: false, error: limitReachedMessage("adaptation_cv"), limitReached: true };
  }

  // Surlignages précédents retirés : seules les modifications de cette demande le seront.
  const current = sanitizeCvHtml(html).replace(/<\/?mark>/g, "");

  let refined;
  try {
    refined = await refineCv(current, offerContext(detail), readHistory(history), request);
  } catch (error) {
    return { ok: false, error: claudeErrorMessage(error, "refineCv") };
  }
  const updated = refined ? sanitizeCvHtml(refined.html) : "";
  if (!refined || updated.replace(/<[^>]+>/g, "").trim().length < 20 || updated.length > CV_HTML_MAX_LENGTH) {
    return { ok: false, error: "La modification n'a pas pu être appliquée. Reformule ta demande." };
  }

  await recordAiUsage("adaptation_cv");
  return {
    ok: true,
    reply: refined.reponse.trim() || "C'est fait : les modifications sont surlignées dans ton CV.",
    html: updated,
    usage: { used: usage.used + 1, limit: usage.limit },
  };
}
