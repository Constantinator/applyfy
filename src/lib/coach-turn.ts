import type { CoachReply } from "./coach-llm";
import { listenText, type Listening } from "./coach-intent";
import { offerMarkersAfter, offerStageOf, type OfferStep } from "./coach-offer";
import type { CoachLang } from "./coach-outcome";
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
  context: {
    scoring: ScoringContext;
    offerKeywords?: string[];
    language?: CoachLang;
    listening?: Listening;
    /** CV lié : étapes de l'offre (coach-offer.ts) et points abandonnés, marqueurs des étapes faites compris. */
    offerSteps?: OfferStep[];
    skipped?: string[];
  };
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

/** Réponse sans changement du titre du CV (refusé par le candidat) ; telle quelle sinon. */
export function withoutTitle(reply: CoachReply): CoachReply {
  const update = reply.update;
  if (update?.section !== "personal" || !("jobTitle" in update.data)) return reply;
  const rest = { ...update.data };
  delete rest.jobTitle;
  console.warn("[cv-builder coach] changement de titre retiré : le candidat l'a refusé");
  return Object.keys(rest).length
    ? { ...reply, update: { section: "personal", data: rest } }
    : { ...reply, update: null, raw: null, invalid: false, changeSummary: "" };
}

/** Le résumé cite entre « » une puce d'expérience restée identique (présente avant et après). */
export function quotesUnchangedBullet(summary: string, before: CvData, after: CvData) {
  const bullets = (cv: CvData) => new Set(cv.experiences.flatMap((e) => e.bullets.map((b) => b.trim())));
  const was = bullets(before);
  const is = bullets(after);
  return [...summary.matchAll(/«\s*([^»]+?)\s*»/g)].some((m) => was.has(m[1]) && is.has(m[1]));
}

/**
 * Suite d'un échange du coach à partir de sa première réponse : modification vérifiée par le
 * code ; textes refusés (ou contenu invalide) : un nouvel essai, invisible pour le candidat (sauf
 * si les adaptations du mois sont épuisées) ; textes encore refusés retirés, jamais écrits dans le
 * CV ; puis texte affiché.
 */
export async function runCoachTurn({ current, context, turns, request, reply, limitReached, retry }: CoachTurnInput): Promise<CoachTurnResult> {
  // CV lié : étape de l'offre de cet échange (null en mode libre). Le candidat vient de refuser
  // le titre proposé : un changement de titre est retiré de la réponse, sans autre effet.
  const stage = offerStageOf(context, !turns.some((t) => t.role === "assistant"));
  const titleLocked = stage?.resolve === "titre" && (context.listening?.refusal ?? false);
  if (titleLocked) reply = withoutTitle(reply);
  let answer = reply;
  let proposal = reply.update ? buildProposal(current, reply.update) : null;
  // Proposition telle que construite : null alors que le coach a bien proposé quelque chose = « ne change rien ».
  let built = proposal;
  // Le mode est celui de la première réponse : le nouvel essai ne peut pas en changer pour passer
  // la vérification. Nombres autorisés en mode demande : ceux du CV et des messages du candidat.
  const mode = reply.mode;
  const check = {
    mode,
    candidateMessages: [request, ...turns.filter((t) => t.role === "user").map((t) => t.content)],
    shorten: context.listening?.shorten ?? false,
  };
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
      answer = titleLocked ? withoutTitle(second) : second;
      proposal = answer.update ? buildProposal(current, answer.update) : null;
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
  const appliedLabels: string[] = [];
  for (const change of proposal?.changes ?? []) {
    const next = applyCoachChange(updated, change);
    if (next) {
      updated = next;
      applied++;
      appliedLabels.push(change.label);
    } else {
      stale++;
      console.error("[cv-builder coach] changement inapplicable", change.kind, change.label);
    }
  }
  // Étape de l'offre résolue : marqueur renvoyé avec les points abandonnés (rien en mode libre).
  const markers = offerMarkersAfter(stage, mode);
  const skippedNow = [...new Set([...reply.skippedPoints, ...answer.skippedPoints, ...markers])];
  // Contenu seulement réorganisé : gratuit, même une fois les adaptations du mois épuisées.
  const reorganized = applied > 0 && isReorganization(current, updated);

  // Adaptations du mois épuisées : pas de modification, le coach continue avec sa question.
  if (reply.raw && limitReached && !reorganized) {
    return {
      kind: "quotaBlocked",
      text: quotaBlockedText({ mode, section: reply.raw.section, message: reply.message, lang: context.language }),
      mode,
      skippedPoints: markers.length ? [...new Set([...reply.skippedPoints, ...markers])] : reply.skippedPoints,
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
    // Annonce fidèle : emplacements réellement modifiés, emplacement de chaque texte refusé, et
    // résumé du modèle écarté s'il cite une puce restée identique.
    appliedLabels,
    refusedLabels: Object.fromEntries((built?.changes ?? []).map((c) => [c.id, c.label])),
    summaryFaithful: !quotesUnchangedBullet(answer.changeSummary, current, updated),
    scoreBefore: scored?.before ?? 0,
    scoreAfter: scored?.after.score ?? null,
    corrections: scored?.after.corrections.map((c) => c.message) ?? [],
    offerKeywords: present ? offerKeywords.filter((k) => !present.has(k)) : [],
    lang: context.language,
  });

  // Le coach écoute : arrêt des questions, pas de relance après un refus, clôture jamais redite,
  // réponse directe à « c'est prêt ? » (coach-intent.ts).
  const before = scoreCv(current, context.scoring);
  const final = scored?.after ?? before;
  const shown = context.listening
    ? listenText({
        text,
        mode,
        lang: context.language ?? "fr",
        listening: context.listening,
        score: final.score,
        scoreBefore: before.score,
        corrections: final.corrections.map((c) => c.message),
        previousCoach: turns.filter((t) => t.role === "assistant").map((t) => t.content),
      })
    : text;

  return {
    kind: "done",
    text: shown,
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
