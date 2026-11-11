// Une conversation du banc d'essai, par le vrai pipeline du coach : contexte du score
// (cv-scoring-context), contexte du coach (coach-context), appels (coach-llm), échange
// (coach-turn). Seules les lectures sont remplacées : candidature synthétique au lieu de la base,
// mots-clés du marché figés au lieu de job_keywords. L'historique suit l'éditeur : premier message
// compris, messages d'erreur exclus, points abandonnés cumulés.
import type Anthropic from "@anthropic-ai/sdk";

import { ClaudeRefusalError } from "../../src/lib/claude-structured.ts";
import { buildCoachContext } from "../../src/lib/coach-context.ts";
import { listeningState } from "../../src/lib/coach-intent.ts";
import { coachBuilderCv, coachOpening, type CoachReply } from "../../src/lib/coach-llm.ts";
import { closedOpening } from "../../src/lib/coach-outcome.ts";
import { isCvClosed, type CoachTurn } from "../../src/lib/coach-prompt.ts";
import { buildProposal, type ChangeProblem } from "../../src/lib/coach-proposals.ts";
import { runCoachTurn } from "../../src/lib/coach-turn.ts";
import { chatContent, fitCvData, targetJobOf, withoutEmptyLines, type CvData } from "../../src/lib/cv-builder-types.ts";
import { scoreCv } from "../../src/lib/cv-score.ts";
import { cvScoringSector, scoringOfferFor } from "../../src/lib/cv-sector-context.ts";
import { scoringContextForSector } from "../../src/lib/cv-scoring-context.ts";
import { REFINE_MESSAGE_MAX_LENGTH } from "../../src/lib/cv-types.ts";
import { BudgetExceeded, type ParseClient } from "./budget.ts";
import { DEFAULTS } from "./config.ts";
import type { Fixtures, Scenario } from "./fixtures.ts";
import { judgeConversation, judgeUserContent, type JudgeVerdict } from "./judge.ts";
import { nextCandidateMessage, type Exchange } from "./simulator.ts";

// Textes de l'application (actions/cv-builder.ts, claude.ts) affichés en cas d'échec : recopiés,
// car ces fichiers dépendent de Next ou de la clé du serveur.
const REFUSAL_TEXT = "Le coach ne peut pas répondre à ce message. Reformule-le ou passe au point suivant.";
const NO_REPLY_TEXT = "Le coach n'a pas pu répondre. Reformule ton message.";
/** Bornes de l'action (COACH_HISTORY_MAX, SKIPPED_MAX). */
const HISTORY_MAX = 30;
const SKIPPED_MAX = 50;

/** Texte refusé par la vérification : emplacement, texte d'origine (null : ajout), texte proposé, causes. */
export type RefusedText = { label: string | null; original: string | null; proposed: string; causes: string[] };

export type TurnRecord = {
  user: string;
  coachText: string;
  /** Réponse affichée comme erreur : absente de l'historique envoyé au coach. */
  error: "refus" | "sans-reponse" | "erreur" | null;
  mode: CoachReply["mode"] | null;
  section: string | null;
  applied: number;
  stale: number;
  retried: boolean;
  invalid: boolean;
  /** Textes refusés à la première vérification, et encore refusés après le second essai. */
  firstProblems: RefusedText[];
  problems: RefusedText[];
  skipped: string[];
  /** Annonce « C'est fait… » affichée (première phrase du texte), null sinon. */
  claim: string | null;
  /** Textes cités entre « » dans l'annonce qui sont des puces restées identiques. */
  unchangedQuoted: string[];
  scoreBefore: number;
  scoreAfter: number;
};

export type ConversationRecord = {
  scenarioId: string;
  set: Scenario["set"];
  case: Scenario["case"];
  type: string;
  repeat: number;
  profileId: string;
  offerId: string | null;
  persona: string;
  language: "fr" | "en";
  expectedSector: string;
  sectorStart: string;
  sectorEnd: string;
  startScore: number;
  endScore: number;
  startCv: CvData;
  endCv: CvData;
  opening: string | null;
  turns: TurnRecord[];
  endReason: "candidat" | "max-tours" | "cloture" | "erreur" | "plafond";
  error: string | null;
  judge: JudgeVerdict | null;
};

export type Clients = { coach: ParseClient; simulator: ParseClient; judge: ParseClient | null };

/**
 * Textes refusés avec leur texte d'origine : la proposition de la réponse est reconstruite
 * (buildProposal, pur) et chaque refus retrouvé par son texte proposé.
 */
function refusedTexts(current: CvData, reply: CoachReply | null, problems: ChangeProblem[]): RefusedText[] {
  const changes = reply?.update ? (buildProposal(current, reply.update)?.changes ?? []) : [];
  return problems.map((p) => {
    const change = changes.find((c) => c.after === p.text) ?? changes.find((c) => c.after.includes(p.text) || p.text.includes(c.after));
    return { label: change?.label ?? null, original: change?.before ?? null, proposed: p.text, causes: p.problems };
  });
}

const ANNOUNCE = /^(c'est fait|c’est fait|done|it's done)\b/i;
/** Annonce de modification : première phrase du texte affiché si elle commence par « C'est fait ». */
const claimOf = (text: string) => {
  const first = text.trim().split(/(?<=[.!])\s/)[0] ?? "";
  return ANNOUNCE.test(first) ? first : null;
};
/** Puces citées dans l'annonce et restées identiques (présentes avant et après le tour). */
function unchangedQuoted(claim: string | null, before: CvData, after: CvData) {
  if (!claim) return [];
  const bullets = (cv: CvData) => new Set(cv.experiences.flatMap((e) => e.bullets.map((b) => b.trim())));
  const b = bullets(before);
  const a = bullets(after);
  return [...claim.matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1]).filter((q) => b.has(q) && a.has(q));
}

export async function runConversation(fx: Fixtures, scenario: Scenario, repeat: number, clients: Clients, maxTurns: number): Promise<ConversationRecord> {
  const profile = fx.profiles.get(scenario.profile)!;
  const offer = scenario.offer ? fx.offers.get(scenario.offer)! : null;
  const detail = offer?.detail ?? null;
  const applicationId = detail?.application.id ?? null;
  const coach = clients.coach as unknown as Anthropic;

  // CV de départ (profil, injection éventuelle dans une puce).
  let cv: CvData = structuredClone(profile.cv);
  if (scenario.cvPatch) {
    const exp = cv.experiences.find((e) => e.id === scenario.cvPatch!.experienceId)!;
    exp.bullets = [...exp.bullets, scenario.cvPatch.bullet];
  }
  const startCv = structuredClone(cv);

  // Contexte du score comme loadBuilderCvScoring : offre de la candidature liée, sinon CV ; mots-clés figés.
  const scoringFor = (data: CvData) => {
    const scoringOffer = scoringOfferFor(applicationId, detail);
    const sector = cvScoringSector(JSON.stringify(chatContent(data)), targetJobOf(data), scoringOffer);
    return scoringContextForSector(sector, scoringOffer, fx.marketKeywords[sector] ?? []);
  };
  let skipped: string[] = [];
  const contextFor = (data: CvData, request: string | null = null) => ({ ...buildCoachContext(data, scoringFor(data), detail, request), skipped: skipped.slice(-SKIPPED_MAX) });

  const start = contextFor(cv);
  const record: ConversationRecord = {
    scenarioId: scenario.id,
    set: scenario.set,
    case: scenario.case,
    type: scenario.type,
    repeat,
    profileId: profile.id,
    offerId: offer?.id ?? null,
    persona: scenario.persona,
    language: profile.language,
    expectedSector: scenario.expectedSector,
    sectorStart: start.sector,
    sectorEnd: start.sector,
    startScore: start.score.value,
    endScore: start.score.value,
    startCv,
    endCv: startCv,
    opening: null,
    turns: [],
    endReason: "max-tours",
    error: null,
    judge: null,
  };

  const history: CoachTurn[] = [];
  const transcript: Exchange[] = [];
  try {
    // Premier message (coachOpeningAction) : texte fixe si le CV est déjà clos.
    record.opening = isCvClosed(start.score.value) ? closedOpening(start.score.value, start.language) : ((await coachOpening(coach, start))?.slice(0, 2000) ?? null);
    if (record.opening) {
      history.push({ role: "assistant", content: record.opening });
      transcript.push({ role: "coach", text: record.opening });
    }

    // Après le passage à 80 (ou CV déjà clos) : quelques messages encore, pour vérifier que le coach
    // ne pose plus de question de parcours.
    let afterClosure: number | null = isCvClosed(start.score.value) ? DEFAULTS.turnsAfterClosure : null;
    let lastMessage = false;
    for (let i = 0; i < maxTurns; i++) {
      if (afterClosure !== null && afterClosure <= 0) {
        record.endReason = "cloture";
        break;
      }
      // Message du candidat : imposé au premier tour, sinon écrit par le faux candidat.
      let message = i === 0 && scenario.firstMessage ? scenario.firstMessage : null;
      if (message === null) {
        const next = await nextCandidateMessage(clients.simulator, {
          scenario,
          profile,
          persona: fx.personas[scenario.persona],
          offerTitle: offer?.detail.application.position ?? null,
          cvJson: JSON.stringify(chatContent(cv)),
          transcript,
        });
        if (!next || !next.message.trim()) {
          record.endReason = "candidat";
          break;
        }
        message = next.message;
        lastMessage = next.done;
      }
      const request = message.trim().slice(0, REFINE_MESSAGE_MAX_LENGTH);

      // CV affiché, comme readShownCv : contenu de l'éditeur revalidé, champs enregistrés réajoutés.
      const fitted = fitCvData(JSON.parse(JSON.stringify(chatContent(cv))));
      const current: CvData = {
        ...withoutEmptyLines(fitted.data),
        personal: { ...fitted.data.personal, photo: cv.personal.photo },
        style: cv.style,
        analysis: cv.analysis,
        targetJob: cv.targetJob,
        origin: cv.origin,
        coach: null,
      };
      const turns = history.slice(-HISTORY_MAX).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
      const context = { ...contextFor(current, request), listening: listeningState(turns, request) };
      const scoreBefore = context.score.value;

      const turn: TurnRecord = {
        user: request,
        coachText: "",
        error: null,
        mode: null,
        section: null,
        applied: 0,
        stale: 0,
        retried: false,
        invalid: false,
        firstProblems: [],
        problems: [],
        skipped: [],
        claim: null,
        unchangedQuoted: [],
        scoreBefore,
        scoreAfter: scoreBefore,
      };
      let reply: CoachReply | null = null;
      try {
        reply = await coachBuilderCv(coach, context, turns, request);
      } catch (error) {
        if (error instanceof BudgetExceeded) throw error;
        turn.error = error instanceof ClaudeRefusalError ? "refus" : "erreur";
        turn.coachText = error instanceof ClaudeRefusalError ? REFUSAL_TEXT : `Erreur : ${error instanceof Error ? error.message : String(error)}`;
      }
      if (!reply && !turn.error) {
        turn.error = "sans-reponse";
        turn.coachText = NO_REPLY_TEXT;
      }
      if (reply) {
        let second: CoachReply | null = null;
        const result = await runCoachTurn({
          current,
          context,
          turns,
          request,
          reply,
          limitReached: false,
          retry: async (retry) => {
            second = await coachBuilderCv(coach, context, turns, request, retry).catch((error) => {
              if (error instanceof BudgetExceeded) throw error;
              return null;
            });
            return second;
          },
        });
        if (result.kind === "done") {
          const notice = fitted.fixes[0]?.message;
          turn.coachText = result.applied && notice ? `${notice} ${result.text}` : result.text;
          turn.mode = result.mode;
          turn.section = result.section;
          turn.applied = result.applied;
          turn.stale = result.stale;
          turn.retried = result.retried;
          turn.invalid = result.invalid;
          turn.firstProblems = refusedTexts(current, reply, result.firstProblems);
          turn.problems = refusedTexts(current, result.retried ? second : reply, result.problems);
          turn.claim = claimOf(turn.coachText);
          turn.unchangedQuoted = unchangedQuoted(turn.claim, current, result.updated);
          turn.skipped = result.skippedPoints;
          if (result.applied) cv = { ...result.updated, coach: null };
        } else {
          turn.coachText = result.text;
          turn.mode = result.mode;
          turn.skipped = result.skippedPoints;
        }
        if (turn.skipped.length) skipped = [...new Set([...skipped, ...turn.skipped])];
      }
      turn.scoreAfter = scoreCv(cv, scoringFor(cv)).score;
      record.turns.push(turn);

      transcript.push({ role: "candidat", text: request }, { role: "coach", text: turn.coachText });
      history.push({ role: "user", content: request });
      if (!turn.error) history.push({ role: "assistant", content: turn.coachText });
      if (afterClosure !== null) afterClosure--;
      else if (isCvClosed(turn.scoreAfter)) afterClosure = DEFAULTS.turnsAfterClosure;
      if (lastMessage) {
        record.endReason = "candidat";
        break;
      }
    }
  } catch (error) {
    if (error instanceof BudgetExceeded) {
      record.endReason = "plafond";
      record.error = error.message;
    } else {
      record.endReason = "erreur";
      record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
  }

  const end = scoringFor(cv);
  record.endCv = cv;
  record.endScore = scoreCv(cv, end).score;
  record.sectorEnd = end.sector;

  // Juge : seulement pour une conversation complète (pas après le plafond).
  if (clients.judge && record.endReason !== "plafond" && record.turns.length) {
    try {
      record.judge = await judgeConversation(
        clients.judge,
        judgeUserContent({
          caseLabel: scenario.case === "lie" ? "CV lié à une offre : le poste visé est imposé par l'offre" : "CV libre : le poste visé se déduit avec le candidat",
          offer: offer ? { position: offer.detail.application.position, sector: offer.detail.application.sector } : null,
          facts: profile.facts,
          request: scenario.type.startsWith("demande") ? (scenario.firstMessage ?? null) : null,
          cvBefore: JSON.stringify(chatContent(startCv)),
          cvAfter: JSON.stringify(chatContent(cv)),
          transcript,
        }),
      );
    } catch (error) {
      if (error instanceof BudgetExceeded) {
        record.endReason = "plafond";
        record.error = error.message;
      } else record.error = `juge : ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return record;
}
