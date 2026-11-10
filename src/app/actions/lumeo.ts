"use server";

import { unstable_rethrow } from "next/navigation";

import { getAccountName } from "@/lib/account";
import { countAiUsageToday, checkAiRateLimit, readAiUsage, recordAiUsage } from "@/lib/ai-usage";
import { isLimitReached } from "@/lib/ai-usage-limits";
import { getApplicationDetail, getApplications } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { answerLumeo, ClaudeRefusalError, isClaudeConfigured } from "@/lib/claude";
import { getLatestBuilderCv } from "@/lib/cv-builder";
import { targetJobOf } from "@/lib/cv-builder-types";
import { scoreCv, weakestCategory } from "@/lib/cv-score";
import { loadScoringContext } from "@/lib/cv-score-context";
import { LUMEO_APP_GUIDE, lumeoPlanKind, lumeoPlansBlock, lumeoUserPlanBlock } from "@/lib/lumeo-knowledge";
import { lumeoMockEnabled, mockLumeoReply } from "@/lib/lumeo-mock";
import {
  LUMEO_QUESTION_MAX,
  buildLumeoContext,
  lumeoGate,
  lumeoGateMessage,
  lumeoTurns,
  lumeoUserContent,
  parseLumeoLocation,
  type LumeoCvInput,
  type LumeoLocation,
  type LumeoOfferInput,
} from "@/lib/lumeo-panel";
import { LUMEO_PANEL_TEXTS as T } from "@/lib/lumeo-texts";
import type { DocumentChatResult } from "@/lib/refine";

/** Dernier CV du CV Builder, résumé pour Lumeo (sans contact ni photo) ; null sans CV ou en cas d'échec. */
async function lumeoCv(): Promise<LumeoCvInput | null> {
  try {
    const cv = await getLatestBuilderCv();
    if (!cv) return null;
    const context = await loadScoringContext(cv.data);
    const score = scoreCv(cv.data, context);
    const weakPoints = score.corrections.map((c) => c.message).slice(0, 3);
    const weakest = weakestCategory(score)?.label;
    return {
      score: score.score,
      weakPoints: weakPoints.length ? weakPoints : weakest ? [weakest] : [],
      sector: context.sectorName,
      targetJob: targetJobOf(cv.data) || cv.data.personal.jobTitle,
      experiences: cv.data.experiences.map(({ position, startDate, endDate, current }) => ({ position, startDate, endDate, current })),
      skills: cv.data.skills.map((s) => s.name),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[lumeo] lecture du dernier CV", error);
    return null;
  }
}

/** Offre de la fiche ouverte, relue avec les droits de l'utilisateur (jamais envoyée par le navigateur). */
async function lumeoOffer(location: LumeoLocation): Promise<LumeoOfferInput | null> {
  if (location.page !== "fiche" || !location.applicationId) return null;
  const detail = await getApplicationDetail(location.applicationId);
  if (!detail) return null;
  const { company, position, location: city, status, applied_at, last_contact_at, is_example, sector, offer_summary, offer_description } =
    detail.application;
  return { company, position, location: city, status, applied_at, last_contact_at, is_example, sector, offer_summary, offer_description };
}

/**
 * Question posée à Lumeo depuis le panneau global. Signature du chat (RefineChat) : `where` est
 * l'emplacement (« fiche:<id> », « dashboard »…), `_html` est inutilisé (aucun document). Aucune
 * écriture hors du compteur d'usage ; rien n'est enregistré de la conversation, ni journalisé.
 * Quota : celui du coach (cvb_coach), compté seulement si une réponse arrive.
 */
export async function askLumeoAction(where: string, _html: string, message: string, history: unknown): Promise<DocumentChatResult> {
  if (typeof where !== "string" || typeof message !== "string") return { ok: false, error: "Requête invalide." };
  const [page, applicationId] = where.split(":");
  const location = parseLumeoLocation({ page, applicationId });
  if (!location) return { ok: false, error: "Requête invalide." };
  const question = message.trim();
  if (!question) return { ok: false, error: T.empty_question };
  if (question.length > LUMEO_QUESTION_MAX) return { ok: false, error: T.tooLong };

  const mock = lumeoMockEnabled();
  if (!mock && !isClaudeConfigured()) return { ok: false, error: "Lumeo n'est pas activé (clé API Claude manquante)." };

  await requireUser();
  const [usage, coachToday] = await Promise.all([readAiUsage(), countAiUsageToday("cvb_coach")]);
  const counter = { used: coachToday, limit: null };
  const sorry = (reply: string): DocumentChatResult => ({ ok: true, reply, html: null, usage: counter, sorry: true });

  // Borne de sécurité mensuelle du compteur (cvb_coach) : traitée comme la limite du jour.
  const gate = isLimitReached(usage.counts.cvb_coach) ? "daily" : lumeoGate({ premium: usage.premium, coachToday, usedToday: usage.usedToday });
  if (gate === "quota") return { ok: true, reply: "", html: null, usage: counter, limitNotice: lumeoGateMessage(gate) };
  if (gate === "daily") return sorry(lumeoGateMessage(gate));
  const rate = await checkAiRateLimit();
  if (!rate.ok) return sorry(T.rate);

  let reply: string | null;
  try {
    if (mock) {
      await new Promise((resolve) => setTimeout(resolve, 900)); // « il réfléchit » visible
      reply = mockLumeoReply(question, location);
    } else {
      const [accountName, cv, applications, offer, beta] = await Promise.all([
        getAccountName().catch(() => null),
        lumeoCv(),
        getApplications().then((r) => r.applications),
        lumeoOffer(location),
        getMyBeta(), // sans échec : null si indisponible
      ]);
      // Plan et quotas restants, cette question comprise (comptée dès qu'une réponse arrive).
      const userPlan = lumeoUserPlanBlock({
        kind: lumeoPlanKind({ premium: usage.premium, betaActive: hasBetaPremium(beta) }),
        counts: usage.counts,
        usedToday: usage.usedToday + 1,
        coachToday: coachToday + 1,
      });
      const knowledge = { plans: lumeoPlansBlock(), userPlan, guide: LUMEO_APP_GUIDE };
      const context = buildLumeoContext({ location, firstName: accountName?.firstName ?? null, cv, applications, offer, now: new Date(), knowledge });
      reply = await answerLumeo(lumeoUserContent(context, lumeoTurns(history), question));
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ClaudeRefusalError) return sorry(T.refusal);
    // Journalisation sans le contenu de la conversation.
    console.error("[lumeo] réponse", error instanceof Error ? `${error.name}: ${error.message}` : "erreur inconnue");
    return sorry(T.error);
  }
  if (!reply) return sorry(T.error);

  await recordAiUsage("cvb_coach");
  return { ok: true, reply, html: null, usage: { used: coachToday + 1, limit: null } };
}
