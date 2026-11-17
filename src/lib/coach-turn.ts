import type { CoachReply } from "./coach-llm";
import {
  asksFirstPerson,
  asksToStop,
  figureNotAsked,
  isBareYes,
  isTranslationRequest,
  listenText,
  removalAllowed,
  removalProposed,
  type Listening,
} from "./coach-intent";
import { offerMarkersAfter, offerStageOf, type OfferGap, type OfferStep } from "./coach-offer";
import { mergeSkipped, type SkippedEntry } from "./skipped-points";
import type { CoachLang } from "./coach-outcome";
import { coachReplyText, quotaBlockedText, SCHOOL_PROJECT_TEXTS, type BulletChange } from "./coach-outcome";
import type { CoachRetry, CoachTurn } from "./coach-prompt";
import { announcementLanguage } from "./coach-language";
import { plainCoachText } from "./coach-plain";
import { applyCoachChange, buildProposals, changeSection, checkProposal, isReorganization, updateTarget, withoutProblems, type ChangeProblem, type CoachChange, type CoachUpdate } from "./coach-proposals";
import { cvDataToText, type CvData } from "./cv-builder-types";
import { correctionsForCoach, scoreCv, type ScoringContext } from "./cv-score";
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
    offerGap?: OfferGap | null;
    offerStudent?: boolean;
    skipped?: SkippedEntry[];
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
  | { kind: "quotaBlocked"; text: string; mode: CoachReply["mode"]; skippedPoints: SkippedEntry[] }
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
      skippedPoints: SkippedEntry[];
      /** Première section modifiée (null : aucune), et toutes les sections de la réponse. */
      section: string | null;
      sections: string[];
      /** Sections des mises à jour retirées au-delà du plafond (updatesCap). */
      droppedSections: string[];
      scoreBefore: number | null;
      scoreAfter: number | null;
      /** CV lié : écart avec l'offre affiché dans cet échange (vide sinon) ; absent en mode libre. */
      offerGap?: string;
    };

/** Réponse sans changement du titre du CV (refusé par le candidat) ; telle quelle sinon. */
export function withoutTitle(reply: CoachReply): CoachReply {
  const isTitle = (u: CoachUpdate) => u.section === "personal" && "jobTitle" in u.data;
  if (!reply.updates.some(isTitle)) return reply;
  const updates = reply.updates.flatMap((update): CoachUpdate[] => {
    if (update.section !== "personal" || !("jobTitle" in update.data)) return [update];
    const rest = { ...update.data };
    delete rest.jobTitle;
    return Object.keys(rest).length ? [{ section: "personal", data: rest }] : [];
  });
  console.warn("[cv-builder coach] changement de titre retiré : le candidat l'a refusé");
  return updates.length ? { ...reply, updates } : { ...reply, updates: [], raw: [], invalid: false, changeSummary: "" };
}

/** Plafond de mises à jour par réponse en mode demande. */
export const COACH_MAX_UPDATES = 3;

/**
 * Mises à jour gardées dans une réponse : 3 en mode demande, 1 en parcours (un point à la fois) ou
 * quand le dernier message n'est qu'un « oui » ou un « ok » (proposition de continuer acceptée).
 */
export function updatesCap(mode: CoachReply["mode"], request: string): number {
  return mode === "demande" && !isBareYes(request) ? COACH_MAX_UPDATES : 1;
}

/**
 * Réponse limitée à ses `cap` premières mises à jour, dans l'ordre écrit par le modèle (contenus
 * invalides compris) ; `dropped` : sections des mises à jour retirées.
 */
export function capUpdates(reply: CoachReply, cap: number): { reply: CoachReply; dropped: string[] } {
  // Réponse sans « raw » aligné (construite à la main) : la limite porte sur les mises à jour lues.
  if (reply.raw.filter((r) => !r.invalid).length !== reply.updates.length) {
    return reply.updates.length <= cap
      ? { reply, dropped: [] }
      : { reply: { ...reply, updates: reply.updates.slice(0, cap) }, dropped: reply.updates.slice(cap).map((u) => u.section) };
  }
  if (reply.raw.length <= cap) return { reply, dropped: [] };
  const raw = reply.raw.slice(0, cap);
  const valid = raw.filter((r) => !r.invalid).length;
  return {
    reply: { ...reply, raw, updates: reply.updates.slice(0, valid), invalid: raw.some((r) => r.invalid) },
    dropped: reply.raw.slice(cap).map((r) => r.section),
  };
}

/** Mot d'école dans une puce (« école », « université », « campus », « projet de fin d'études », « school »…). */
const SCHOOL_WORD =
  /(?<![\p{L}\d])([ée]coles?|universit[ée]s?|campus|fac|facult[ée]|projet de fin d'[ée]tudes|pfe|schools?|universit(y|ies)|college|capstone|final[- ]year project)(?![\p{L}\d])/iu;
/** Le candidat parle de son école (« de mon école », « ma fac », « my university »). */
const OWN_SCHOOL =
  /(?<![\p{L}\d])((mon|ma|notre) ([ée]cole|fac|facult[ée]|universit[ée]|campus)|projet de fin d'[ée]tudes|pfe|(my|our) (school|university|college|campus)|final[- ]year project|capstone)(?![\p{L}\d])/iu;
/** Entreprise qui est elle-même un établissement d'enseignement. */
const SCHOOL_ORG =
  /(?<![\p{L}\d])([ée]cole|universit[ée]|institut|iut|lyc[ée]e|coll[èe]ge|facult[ée]|campus|insa|acad[ée]mie|school|university|college|institute|academy)(?![\p{L}\d])/iu;
/** Stage seulement (ni alternance, ni apprentissage, ni CDI). */
const INTERNSHIP = /(?<![\p{L}\d])(stage|stagiaire|intern|internship|trainee)(?![\p{L}\d])/iu;

/**
 * Nouvelle puce appliquée à un stage qui évoque l'école du candidat (O06 : « API REST utilisée par
 * 3 équipes de l'école ») : le candidat parle de son école dans son dernier message, et
 * l'entreprise du stage n'est pas un établissement. Le serveur demande si c'est un projet d'école.
 */
export function schoolProjectBullet(changes: CoachChange[], cv: CvData, request: string): boolean {
  if (!OWN_SCHOOL.test(request)) return false;
  return changes.some((change) => {
    if (change.kind !== "bullet" || change.before !== null || change.moved) return false;
    const experience = cv.experiences.find((e) => e.id === change.experienceId);
    if (!experience || !INTERNSHIP.test(experience.position) || SCHOOL_ORG.test(experience.company)) return false;
    return SCHOOL_WORD.test(change.after);
  });
}

/** Le résumé du modèle est-il dans la langue retenue ? null si sa langue ne peut pas être décidée. */
function sameLanguage(summary: string, lang: "fr" | "en"): boolean | null {
  const detected = announcementLanguage(summary);
  return detected === null ? null : detected === lang;
}

/** Nombre de mots annoncé (« de 12 à 9 mots », « 30 words ») : jamais repris du modèle. */
const WORD_COUNT = /\d+\s*(mots?|words?)\b/i;
const countWords = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;

/** Mots avant et après des textes modifiés (ajouts exclus) ; undefined si aucun texte existant n'a changé. */
export function wordCounts(texts: { before: string | null; after: string }[]): { before: number; after: number } | undefined {
  const changed = texts.filter((t) => t.before !== null);
  if (!changed.length) return undefined;
  return { before: changed.reduce((n, t) => n + countWords(t.before ?? ""), 0), after: changed.reduce((n, t) => n + countWords(t.after), 0) };
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
  // Le mode est celui de la première réponse : le nouvel essai ne peut pas en changer pour passer
  // la vérification. Nombres autorisés en mode demande : ceux du CV et des messages du candidat.
  const mode = reply.mode;
  // Mises à jour au-delà du plafond (3 en mode demande, 1 en parcours ou pour un « oui » seul) :
  // retirées, jamais écrites ; le texte affiché propose de continuer avec elles.
  const cap = updatesCap(mode, request);
  const firstCapped = capUpdates(reply, cap);
  reply = firstCapped.reply;
  const dropped = firstCapped.dropped;
  if (dropped.length) console.warn(`[cv-builder coach] mises à jour au-delà du plafond (${cap}) retirées : ${dropped.join(", ")}`);
  if (titleLocked) reply = withoutTitle(reply);
  const sections = [...new Set(reply.raw.map((r) => r.section))];
  let answer = reply;
  const first = buildProposals(current, reply.updates);
  let proposal = first.proposal;
  // Proposition telle que construite : null alors que le coach a bien proposé quelque chose = « ne change rien ».
  let built = proposal;
  // Première proposition : emplacements de ses textes refusés (annonce après un second essai).
  const firstBuilt = proposal;
  const check = {
    mode,
    candidateMessages: [request, ...turns.filter((t) => t.role === "user").map((t) => t.content)],
    // Au moins 20 % de mots en moins : seulement quand le dernier message demande de raccourcir,
    // en mode demande (jamais pour une puce du parcours ni pour un ajout).
    shorten: mode === "demande" && (context.listening?.shorten ?? false),
    // Suppression d'une puce ou d'un élément : seulement demandée, ou acceptée après une proposition du coach.
    removalAllowed: removalAllowed(turns, request),
    // Refus après une proposition de suppression du coach : le message demande un oui ou un non.
    removalProposed: removalProposed(turns, request),
    // « Je / mon / mes » permis en mode demande seulement si le candidat demande la première personne.
    firstPersonAsked: asksFirstPerson(request),
    // Mode parcours : le candidat a dit ne pas avoir le chiffre demandé, ou la question du coach
    // n'en demandait pas (outils, détails : run 2026-11-16T03-20-31, L14) : une puce peut rester
    // sans chiffre, sans aucun nombre inventé.
    ...(mode === "parcours" && (context.listening?.noFigure || figureNotAsked(turns, request)) ? { figureWaived: true } : {}),
    // Traduction demandée : l'intitulé d'un diplôme n'est jamais traduit.
    ...(isTranslationRequest(request) ? { translation: true } : {}),
    // CV lié : vérifications de l'adaptation à l'offre (absentes en mode libre).
    ...(context.offerSteps ? { offer: { gap: context.offerGap ?? null, sector: context.scoring.sector, student: context.offerStudent ?? false } } : {}),
  };
  let problems = proposal ? checkProposal(proposal, context.scoring, current, check) : [];
  const firstProblems = problems;
  const firstRefused = problems.length;
  let retried = false;
  if (reply.raw.length && !limitReached && (reply.invalid || problems.length)) {
    const second = await retry({
      previous: reply.raw.map(({ section, data }) => ({ section, data })),
      problems: problems.map(({ text, problems }) => ({ text, problems })),
      mode,
      ...(check.figureWaived ? { figureWaived: true } : {}),
    });
    if (second) {
      retried = true;
      const capped = capUpdates(second, cap).reply;
      answer = titleLocked ? withoutTitle(capped) : capped;
      if (reply.raw.length <= 1) {
        // Une seule mise à jour : le second essai remplace la réponse entière.
        proposal = buildProposals(current, answer.updates).proposal;
      } else {
        // Plusieurs mises à jour : les changements des cibles acceptées au premier essai sont gardés ;
        // du second essai, seules les cibles refusées (même section, même id) ou au contenu invalide.
        const refused = new Set(problems.map((p) => first.targets[p.changeId]));
        const invalid = new Set(reply.raw.filter((r) => r.invalid).map((r) => r.section));
        const kept = (first.proposal?.changes ?? []).filter((c) => !refused.has(first.targets[c.id]));
        const redone = buildProposals(
          current,
          answer.updates.filter((u) => refused.has(updateTarget(u.section, u.data)) || invalid.has(u.section)),
        ).proposal;
        const changes = [...kept, ...(redone?.changes ?? [])];
        proposal = changes.length ? { id: redone?.id ?? first.proposal?.id ?? "", changes } : null;
      }
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
  const appliedTexts: { before: string | null; after: string; list: boolean }[] = [];
  const bulletChanges: BulletChange[] = [];
  const appliedChanges: CoachChange[] = [];
  let summaryText: string | undefined;
  for (const change of proposal?.changes ?? []) {
    const next = applyCoachChange(updated, change);
    if (next) {
      updated = next;
      applied++;
      appliedLabels.push(change.label);
      appliedTexts.push({ before: change.before, after: change.after, list: change.kind === "list" });
      appliedChanges.push(change);
      if (change.kind === "bullet") bulletChanges.push({ kind: "written", text: change.after, label: change.label });
      if (change.kind === "removeBullet") bulletChanges.push({ kind: "removed", text: change.before ?? "", label: change.label });
      if (change.kind === "field" && change.target === "summary") summaryText = change.after;
    } else {
      stale++;
      console.error("[cv-builder coach] changement inapplicable", change.kind, change.label);
    }
  }
  // Étape de l'offre résolue : marqueur renvoyé avec les points abandonnés (rien en mode libre).
  // Écart avec l'offre : affiché seulement quand le serveur l'a demandé, avant la question.
  const gap = stage?.sayGap ? (answer.gap ?? "") : "";
  const markers = offerMarkersAfter(stage, mode, gap !== "");
  const skippedNow = mergeSkipped([...reply.skippedPoints, ...answer.skippedPoints], markers);
  // Contenu seulement réorganisé : gratuit, même une fois les adaptations du mois épuisées.
  const reorganized = applied > 0 && isReorganization(current, updated);

  // Adaptations du mois épuisées : pas de modification, le coach continue avec sa question.
  if (reply.raw.length && limitReached && !reorganized) {
    return {
      kind: "quotaBlocked",
      text: plainCoachText(quotaBlockedText({ mode, section: sections.length === 1 ? sections[0] : "", message: gap ? `${gap} ${reply.message}`.trim() : reply.message, lang: context.language }), context.language),
      mode,
      skippedPoints: markers.length ? mergeSkipped(reply.skippedPoints, markers) : reply.skippedPoints,
    };
  }

  console.warn(
    `[cv-builder coach] réponse : mode=${mode}, sections=${sections.join("+") || "aucune"}, changements appliqués=${applied}, ` +
      `textes refusés=${firstRefused} (après le second essai : ${problems.length}), second essai=${retried ? "oui" : "non"}, ` +
      `passages introuvables=${stale}, contenu invalide=${reply.invalid ? "oui" : "non"}, réorganisation=${reorganized ? "oui" : "non"}, points abandonnés=${skippedNow.length}`,
  );

  // Texte affiché, décidé par le code : cause exacte d'un échec, clôture au seuil « prêt à postuler ».
  const scored =
    applied > 0 ? { before: scoreCv(current, context.scoring).score, after: scoreCv(updated, context.scoring) } : null;
  const offerKeywords = context.offerKeywords ?? [];
  // Plusieurs sections modifiées : emplacements que l'annonce des puces et de l'accroche ne cite pas.
  const announcedSummary = Boolean(summaryText) && !check.shorten;
  const alsoLabels =
    new Set(appliedChanges.map(changeSection)).size > 1
      ? appliedChanges
          .filter((c) => c.kind !== "bullet" && c.kind !== "removeBullet" && !(announcedSummary && c.kind === "field" && c.target === "summary"))
          .map((c) => c.label)
      : undefined;
  const present = scored && offerKeywords.length ? new Set(matchKeywords(cvDataToText(updated), offerKeywords, context.scoring.sector)) : null;
  const firstLabels: Record<string, string> = Object.fromEntries((firstBuilt?.changes ?? []).map((c) => [c.id, c.label]));
  const text = coachReplyText({
    mode,
    section: sections[0] ?? null,
    applied,
    stale,
    invalid: answer.invalid,
    firstInvalid: reply.invalid,
    noChange: answer.updates.length > 0 && !built,
    problems,
    // Seul un texte réellement refusé au final figure dans « pas appliqué » : un premier refus dont
    // l'emplacement a été écrit au second essai (L04 : accroche raccourcie à 23 %) n'est plus cité ;
    // une puce abandonnée au second essai, si.
    firstProblems: firstProblems.filter((p) => !appliedLabels.includes(firstLabels[p.changeId] ?? "")),
    message: gap ? `${gap} ${answer.message}`.trim() : answer.message,
    changeSummary: answer.changeSummary,
    // Annonce fidèle : emplacements réellement modifiés, emplacement de chaque texte refusé, et
    // résumé du modèle écarté s'il cite une puce restée identique.
    appliedLabels,
    refusedLabels: { ...firstLabels, ...Object.fromEntries((built?.changes ?? []).map((c) => [c.id, c.label])) },
    // Un nombre de mots annoncé par le modèle n'est jamais repris : le serveur le calcule.
    summaryFaithful:
      !quotesUnchangedBullet(answer.changeSummary, current, updated) &&
      !WORD_COUNT.test(answer.changeSummary) &&
      // Résumé du modèle dans une autre langue que celle retenue pour le candidat (L17, ou langue
      // tirée du seul CV) : annonce du serveur, dans cette langue, seule.
      !(context.language && sameLanguage(answer.changeSummary, context.language) === false),
    // Plusieurs sections : une liste n'entre pas dans le décompte (elle n'est pas raccourcie).
    wordCounts: check.shorten && applied > 0 ? wordCounts(alsoLabels ? appliedTexts.filter((t) => !t.list) : appliedTexts) : undefined,
    // Puces d'expérience : annonce écrite par le serveur, texte réellement écrit cité.
    bulletChanges,
    ...(alsoLabels ? { alsoLabels } : {}),
    // Mode demande : mises à jour au-delà du plafond, proposées pour la suite.
    ...(mode === "demande" && dropped.length ? { overflow: { kept: cap, sections: dropped } } : {}),
    // Accroche : idem, sauf demande de raccourcir (annonce et décompte des mots, comme avant).
    ...(summaryText && !check.shorten ? { summaryText } : {}),
    // CV clos et question ouverte : la réponse du modèle est gardée (sans question).
    ...(context.listening?.openQuestion ? { answerQuestion: true } : {}),
    // Puce ajoutée à un stage qui parle de l'école du candidat : phrase fixe, jamais redite (O06).
    ...(schoolProjectBullet(appliedChanges, current, request) && !turns.some((t) => t.role === "assistant" && SCHOOL_PROJECT_TEXTS.some((p) => t.content.includes(p)))
      ? { schoolProject: true }
      : {}),
    scoreBefore: scored?.before ?? 0,
    scoreAfter: scored?.after.score ?? null,
    corrections: correctionsForCoach(scored?.after.corrections ?? [], context.scoring).map((c) => c.message),
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
        corrections: correctionsForCoach(final.corrections, context.scoring).map((c) => c.message),
        previousCoach: turns.filter((t) => t.role === "assistant").map((t) => t.content),
        ...(context.offerSteps ? { offerKeywords: context.offerKeywords ?? [] } : {}),
        // « Puis on en reste là » en mode demande : questions du modèle retirées de ce message.
        ...(mode === "demande" && asksToStop(request) ? { stopNow: true, modelMessage: gap ? `${gap} ${answer.message}`.trim() : answer.message } : {}),
      })
    : text;

  return {
    kind: "done",
    // Texte affiché sans jargon (« verbe d'action », « (+6 pts) »…), passages cités intacts.
    text: plainCoachText(shown, context.language),
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
    section: sections[0] ?? null,
    sections,
    droppedSections: dropped,
    scoreBefore: scored?.before ?? null,
    scoreAfter: scored?.after.score ?? null,
    ...(context.offerSteps ? { offerGap: gap } : {}),
  };
}
