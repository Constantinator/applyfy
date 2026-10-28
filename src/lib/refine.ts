import "server-only";

import { checkAiAccess, recordAiUsage } from "./ai-usage";
import { type AiUsageCount } from "./ai-usage-limits";
import { getApplicationDetail } from "./applications";
import {
  claudeErrorMessage,
  isClaudeConfigured,
  refineDocument,
  type RefinableDocument,
  type RefineAnalysis,
  type RefineChatTurn,
} from "./claude";
import { CV_HTML_MAX_LENGTH, htmlToText, sanitizeCvHtml } from "./cv-html";
import { matchCvKeywords } from "./cv-keyword-match";
import { detectSector } from "./cv-sector-context";
import { readCvSuggestions, REFINE_MESSAGE_MAX_LENGTH } from "./cv-types";
import { getLatestProfileCvHtml } from "./profile";

// Chat « Affiner avec l'IA » (CV amélioré et lettre) : logique commune aux deux Server
// Actions. Le document n'est pas enregistré : l'éditeur affiche le résultat, que le
// candidat garde (Enregistrer) ou annule.

export type RefineResult =
  | { ok: true; reply: string; html: string; usage: AiUsageCount }
  | { ok: false; error: string; limitReached?: boolean };

/** Résultat d'un message du chat, quel que soit le document : `html` null si le document ne change pas. */
export type DocumentChatResult =
  | {
      ok: true;
      reply: string;
      html: string | null;
      usage: AiUsageCount;
      /** Modification non appliquée (limite du mois) : message affiché avant `reply`, avec le lien Premium. */
      limitNotice?: string;
    }
  | { ok: false; error: string; limitReached?: boolean };

/** Nombre d'échanges précédents transmis à Claude comme contexte. */
const HISTORY_MAX = 6;

const USAGE_KIND = { cv: "affinage_cv", lettre: "affinage_lettre" } as const;
const LABELS = {
  cv: { tooLong: "Le CV est trop long.", done: "C'est fait : les modifications sont surlignées dans ton CV." },
  lettre: {
    tooLong: "La lettre est trop longue.",
    done: "C'est fait : les modifications sont surlignées dans ta lettre.",
  },
} as const;

/**
 * Analyse « Adapter mon CV » pour le chat du CV : mots-clés manquants recalculés sur le CV
 * affiché (hors mots-clés ignorés), conseils et titre proposé ; points des anciennes analyses.
 */
function refineAnalysis(raw: unknown, html: string, position: string): RefineAnalysis | null {
  const saved = readCvSuggestions(raw);
  if (!saved) return null;
  if (saved.kind === "legacy") return { points_forts: saved.ce_qui_matche, mots_cles_manquants: saved.ce_qui_manque };
  const cvText = htmlToText(html);
  const { rows } = matchCvKeywords(saved, cvText, detectSector(cvText ?? "", position));
  return {
    mots_cles_manquants: rows.filter((r) => !r.present && !r.ignored).map((r) => r.keyword),
    conseils: saved.conseils,
    titre_cv: saved.titre_cv || undefined,
  };
}

function readHistory(raw: unknown): RefineChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (turn): turn is RefineChatTurn =>
        Boolean(turn) &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    )
    .slice(-HISTORY_MAX)
    .map(({ role, content }) => ({ role, content: content.slice(0, REFINE_MESSAGE_MAX_LENGTH) }));
}

/**
 * Applique une demande du candidat au document affiché dans l'éditeur (modifications non
 * enregistrées comprises). Chaque message réussi compte dans la limite mensuelle du chat.
 */
export async function refineApplicationDocument(
  document: RefinableDocument,
  id: unknown,
  html: unknown,
  message: unknown,
  history: unknown,
): Promise<RefineResult> {
  if (typeof id !== "string" || typeof html !== "string" || typeof message !== "string") {
    return { ok: false, error: "Requête invalide." };
  }
  const request = message.trim();
  if (!request) return { ok: false, error: "Écris ta demande." };
  if (request.length > REFINE_MESSAGE_MAX_LENGTH) return { ok: false, error: "Ta demande est trop longue." };
  if (html.length > CV_HTML_MAX_LENGTH) return { ok: false, error: LABELS[document].tooLong };
  if (!isClaudeConfigured()) {
    return { ok: false, error: "L'assistant n'est pas activé (clé API Claude manquante)." };
  }

  // Vérifie la connexion ET que la candidature appartient bien à l'utilisateur.
  const detail = await getApplicationDetail(id);
  if (!detail) return { ok: false, error: "Candidature introuvable." };
  const app = detail.application;

  const kind = USAGE_KIND[document];
  const gate = await checkAiAccess(kind);
  if (!gate.ok) return { ok: false, error: gate.message, limitReached: gate.limitReached };

  // Surlignages précédents retirés : seules les modifications de cette demande le seront.
  const current = sanitizeCvHtml(html).replace(/<\/?mark>/g, "");
  const offer = {
    position: app.position,
    company: app.company,
    location: app.location,
    summary: app.offer_summary ?? null,
    description: app.offer_description,
  };

  // CV : l'analyse faite pour cette offre. Lettre : le CV du candidat (celui de l'éditeur
  // de CV pour cette candidature, sinon le dernier CV du profil importé dans l'éditeur).
  const context =
    document === "cv"
      ? { analysis: refineAnalysis(app.cv_suggestions, current, app.position) }
      : { candidateCv: htmlToText(app.cv_improved_html ?? (await getLatestProfileCvHtml())) };

  let refined;
  try {
    refined = await refineDocument(document, current, offer, readHistory(history), request, context);
  } catch (error) {
    return { ok: false, error: claudeErrorMessage(error, `refine:${document}`) };
  }
  const updated = refined ? sanitizeCvHtml(refined.html) : "";
  if (!refined || updated.replace(/<[^>]+>/g, "").trim().length < 20 || updated.length > CV_HTML_MAX_LENGTH) {
    return { ok: false, error: "La modification n'a pas pu être appliquée. Reformule ta demande." };
  }

  await recordAiUsage(kind);
  return {
    ok: true,
    reply: refined.reponse.trim() || LABELS[document].done,
    html: updated,
    usage: { used: gate.count.used + 1, limit: gate.count.limit },
  };
}
