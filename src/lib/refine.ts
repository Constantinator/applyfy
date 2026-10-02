import "server-only";

import { getAiUsageFor, recordAiUsage } from "./ai-usage";
import { isLimitReached, LIMIT_REACHED_MESSAGE, type AiUsageCount } from "./ai-usage-limits";
import { getApplicationDetail } from "./applications";
import {
  claudeErrorMessage,
  isClaudeConfigured,
  refineDocument,
  type RefinableDocument,
  type RefineChatTurn,
} from "./claude";
import { CV_HTML_MAX_LENGTH, sanitizeCvHtml } from "./cv-html";
import { REFINE_MESSAGE_MAX_LENGTH } from "./cv-types";

// Chat « Affiner avec l'IA » (CV amélioré et lettre) : logique commune aux deux Server
// Actions. Le document n'est pas enregistré : l'éditeur affiche le résultat, que le
// candidat garde (Enregistrer) ou annule.

export type RefineResult =
  | { ok: true; reply: string; html: string; usage: AiUsageCount }
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
  const usage = await getAiUsageFor(kind);
  if (isLimitReached(usage)) return { ok: false, error: LIMIT_REACHED_MESSAGE, limitReached: true };

  // Surlignages précédents retirés : seules les modifications de cette demande le seront.
  const current = sanitizeCvHtml(html).replace(/<\/?mark>/g, "");
  const offer = {
    position: app.position,
    company: app.company,
    location: app.location,
    summary: app.offer_summary ?? null,
    description: app.offer_description,
  };

  let refined;
  try {
    refined = await refineDocument(document, current, offer, readHistory(history), request);
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
    usage: { used: usage.used + 1, limit: usage.limit },
  };
}
