import type { CoachReply } from "./coach-llm";
import { coachReplyText, quotaBlockedText } from "./coach-outcome";
import type { CoachRetry, CoachTurn } from "./coach-prompt";
import { applyCoachChange, buildProposal, checkProposal, isReorganization, withoutProblems, type ChangeProblem } from "./coach-proposals";
import { cvDataToText, type CvData } from "./cv-builder-types";
import { scoreCv, type ScoringContext } from "./cv-score";
import { matchKeywords } from "./keyword-match";

// Un échange du coach du CV Builder, une fois sa première réponse reçue : vérification par le
// code, second essai invisible, application au CV et texte affiché. Sans connexion, quota ni
// base : l'action refineBuilderCvAction lit le CV et décompte l'usage ; le banc d'essai du coach
// (scripts/eval) joue le même échange sur des CV synthétiques.

export type CoachTurnInput = {
  /** CV affiché, modifications non enregistrées comprises (sans lignes vides). */
  current: CvData;
  /** Contexte du coach (coach-context.ts) : contexte du score et mots-clés de l'offre manquants. */
  context: { scoring: ScoringContext; offerKeywords?: string[] };
  /** Échanges précédents et dernier message du candidat. */
  turns: CoachTurn[];
  request: string;
  /** Première réponse du coach à ce message. */
  reply: CoachReply;
  /** Adaptations du mois épuisées : rien n'est écrit dans le CV, pas de second essai. */
  limitReached: boolean;
  /** Second essai du coach (contrôle de débit compris) ; null s'il n'a pas pu répondre. */
  retry: (retry: CoachRetry) => Promise<CoachReply | null>;
};

export type CoachTurnResult =
  /** Adaptations du mois épuisées et modification proposée : le coach continue avec sa question. */
  | { kind: "quotaBlocked"; text: string; mode: CoachReply["mode"]; skippedPoints: string[] }
  | {
      kind: "done";
      /** Texte affiché, décidé par le code (cause exacte d'un échec, clôture au seuil). */
      text: string;
      mode: CoachReply["mode"];
      /** CV après les changements appliqués (le même objet que `current` si rien n'a changé). */
      updated: CvData;
      applied: number;
      stale: number;
      /** Textes refusés à la première vérification, et encore refusés après le second essai. */
      firstProblems: ChangeProblem[];
      problems: ChangeProblem[];
      retried: boolean;
      /** Contenu illisible ou invalide (première réponse, réponse retenue). */
      firstInvalid: boolean;
      invalid: boolean;
      /** Contenu seulement réorganisé : gratuit, même une fois les adaptations du mois épuisées. */
      reorganized: boolean;
      skippedPoints: string[];
      section: string | null;
      scoreBefore: number | null;
      scoreAfter: number | null;
    };

/**
 * Suite d'un échange du coach à partir de sa première réponse : modification vérifiée par le
 * code ; textes refusés (ou contenu invalide) : un nouvel essai, invisible pour le candidat (sauf
 * si les adaptations du mois sont épuisées) ; textes encore refusés retirés, jamais écrits dans le
 * CV ; puis texte affiché.
 */
export async function runCoachTurn({ current, context, turns, request, reply, limitReached, retry }: CoachTurnInput): Promise<CoachTurnResult> {
  let answer = reply;
  let proposal = reply.update ? buildProposal(current, reply.update) : null;
  // Proposition telle que construite : null alors que le coach a bien proposé quelque chose = « ne change rien ».
  let built = proposal;
  // Le mode est celui de la première réponse : le nouvel essai ne peut pas en changer pour passer
  // la vérification. Nombres autorisés en mode demande : ceux du CV et des messages du candidat.
  const mode = reply.mode;
  const check = { mode, candidateMessages: [request, ...turns.filter((t) => t.role === "user").map((t) => t.content)] };
  let problems = proposal ? checkProposal(proposal, context.scoring, current, check) : [];
  const firstProblems = problems;
  const firstRefused = problems.length;
  let retried = false;
  if (reply.raw && !limitReached && (reply.invalid || problems.length)) {
    const second = await retry({
      previous: reply.raw,
      problems: problems.map(({ text, problems }) => ({ text, problems })),
      mode,
    });
    if (second) {
      retried = true;
      answer = second;
      proposal = second.update ? buildProposal(current, second.update) : null;
      built = proposal;
      problems = proposal ? checkProposal(proposal, context.scoring, current, check) : [];
    }
  }
  // Textes encore refusés : retirés, jamais écrits dans le CV.
  if (proposal && problems.length) proposal = withoutProblems(proposal, problems);
  // Modification appliquée directement, changement par changement (un passage introuvable est ignoré).
  let updated = current;
  let applied = 0;
  let stale = 0;
  for (const change of proposal?.changes ?? []) {
    const next = applyCoachChange(updated, change);
    if (next) {
      updated = next;
      applied++;
    } else {
      stale++;
      console.error("[cv-builder coach] changement inapplicable", change.kind, change.label);
    }
  }
  const skippedNow = [...new Set([...reply.skippedPoints, ...answer.skippedPoints])];
  // Contenu seulement réorganisé : gratuit, même une fois les adaptations du mois épuisées.
  const reorganized = applied > 0 && isReorganization(current, updated);

  // Adaptations du mois épuisées : pas de modification, le coach continue avec sa question.
  if (reply.raw && limitReached && !reorganized) {
    return {
      kind: "quotaBlocked",
      text: quotaBlockedText({ mode, section: reply.raw.section, message: reply.message }),
      mode,
      skippedPoints: reply.skippedPoints,
    };
  }

  console.warn(
    `[cv-builder coach] réponse : mode=${mode}, section=${reply.raw?.section ?? "aucune"}, changements appliqués=${applied}, ` +
      `textes refusés=${firstRefused} (après le second essai : ${problems.length}), second essai=${retried ? "oui" : "non"}, ` +
      `passages introuvables=${stale}, contenu invalide=${reply.invalid ? "oui" : "non"}, réorganisation=${reorganized ? "oui" : "non"}, points abandonnés=${skippedNow.length}`,
  );

  // Texte affiché, décidé par le code : cause exacte d'un échec, clôture au seuil « prêt à postuler ».
  const scored =
    applied > 0 ? { before: scoreCv(current, context.scoring).score, after: scoreCv(updated, context.scoring) } : null;
  const offerKeywords = context.offerKeywords ?? [];
  const present = scored && offerKeywords.length ? new Set(matchKeywords(cvDataToText(updated), offerKeywords, context.scoring.sector)) : null;
  const text = coachReplyText({
    mode,
    section: reply.raw?.section ?? null,
    applied,
    stale,
    invalid: answer.invalid,
    firstInvalid: reply.invalid,
    noChange: Boolean(answer.update) && !built,
    problems,
    firstProblems,
    message: answer.message,
    changeSummary: answer.changeSummary,
    scoreBefore: scored?.before ?? 0,
    scoreAfter: scored?.after.score ?? null,
    corrections: scored?.after.corrections.map((c) => c.message) ?? [],
    offerKeywords: present ? offerKeywords.filter((k) => !present.has(k)) : [],
  });

  return {
    kind: "done",
    text,
    mode,
    updated,
    applied,
    stale,
    firstProblems,
    problems,
    retried,
    firstInvalid: reply.invalid,
    invalid: answer.invalid,
    reorganized,
    skippedPoints: skippedNow,
    section: reply.raw?.section ?? null,
    scoreBefore: scored?.before ?? null,
    scoreAfter: scored?.after.score ?? null,
  };
}
