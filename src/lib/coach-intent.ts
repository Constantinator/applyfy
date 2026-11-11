import type { CoachLang } from "./coach-outcome";
import { READY_SCORE } from "./cv-score";

// Le coach écoute (lot « le coach écoute ») : intentions du candidat lues par le serveur dans ses
// messages (question directe, refus, demande d'arrêt), état de la session tiré de l'historique, et
// texte affiché corrigé en conséquence. Tout est décidé par le code : le prompt reçoit seulement
// des phrases fixes (coach-prompt.ts, bloc « situation »).

/** « C'est prêt ? », « peut-on valider ? », « is it ready? » : le serveur répond avec le score. */
const READINESS =
  /(est-ce (que )?(c'est |mon cv est |il est |le cv est )?(pr[êe]t|bon|fini|termin[ée]|valid[ée])|c'est (pr[êe]t|bon|fini|ok)\s*\?|(mon|le) cv est (pr[êe]t|bon)\s*\?|(peut-on|on peut|je peux|puis-je) (valider|le valider|l'envoyer|envoyer|postuler)|is (it|my cv) (ready|done|good|ok)|can (we|i) (validate|send|apply)|are we done|am i (ready|done))/i;
/** « Peux-tu confirmer… ? », « can you confirm…? » : le coach répond d'abord oui ou non. */
const CONFIRMATION = /((peux|pourrais)-tu|tu (peux|pourrais)|pouvez-vous) (me )?confirmer|can you confirm|could you confirm/i;
/** Refus ou « je ne sais pas » (sans chiffre donné). */
const NEGATIVE =
  /^\s*(non|nan|no|nope)\b|je (ne )?sais pas|jsp\b|aucune id[ée]e|je (ne )?(me )?souviens (pas|plus)|je n'ai pas (ce|le|de|cette|l')|pas de chiffre|je (ne )?connais pas|je pr[ée]f[èe]re ne pas|i don'?t know|no idea|i don'?t (have|remember)|not sure|i'?d rather not/i;
/** Demande d'arrêt des questions. */
const STOP =
  /plus (de|aucune) questions?|arr[êe]te (les|tes) questions|stop (les|tes|the|asking|with the) questions?|pas d'autres? questions?|no more questions|stop asking/i;
/** Demande de raccourcir un texte. */
const SHORTEN = /raccourci|plus court|moins long|r[ée]dui[st] (la longueur|mon|ma|mes|le|la|les)|condense|all[ée]ge|shorten|shorter|trim|cut down|make it short|more concise/i;

/** Question sur une expérience d'un mot-clé (CV lié : ce que deux refus de suite arrêtent). */
const KEYWORD_QUESTION =
  /exp[ée]rience|as-tu (d[ée]j[àa] )?(utilis|travaill|pratiqu|fait|men[ée])|connais-tu|ma[îi]trises-tu|t'es-tu servi|have you (ever )?(used|worked|done)|experience (with|in)|familiar with|do you know/i;

/** Mot-clé de l'offre cité dans un texte (mot entier, sans tenir compte de la casse). */
function mentionsKeyword(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const key = k.trim().toLowerCase();
    if (!key) return false;
    const at = lower.indexOf(key);
    if (at < 0) return false;
    const before = lower[at - 1] ?? " ";
    const after = lower[at + key.length] ?? " ";
    return !/[\p{L}\d]/u.test(before) && !/[\p{L}\d]/u.test(after);
  });
}

/** Question du coach sur un mot-clé de l'offre. */
export const isKeywordQuestion = (text: string, keywords: string[]) =>
  /\?/.test(text) && KEYWORD_QUESTION.test(text) && mentionsKeyword(text, keywords);

/** Question de chiffre (ce que deux refus de suite arrêtent). */
const FIGURE_QUESTION = /combien|chiffre|nombre|ordre de grandeur|pourcentage|%|budget|how many|how much|number|figure|percentage|amount/i;
/** Proposition de continuer une demande en plusieurs parties. */
const CONTINUE_OFFER = /je continue avec|veux-tu que je continue|on continue avec|je passe à .*\?|shall i continue|should i continue|do you want me to continue|i'?ll continue with/i;

export const isReadinessQuestion = (message: string) => READINESS.test(message);
export const isConfirmationQuestion = (message: string) => CONFIRMATION.test(message);
/** Réponse négative : refus ou information inconnue, sans chiffre donné. */
export const isNegative = (message: string) => NEGATIVE.test(message) && !/\d/.test(message);
export const asksToStop = (message: string) => STOP.test(message);
export const asksToShorten = (message: string) => SHORTEN.test(message);

/** Ce que le serveur a compris de la session (messages du candidat, dernier compris). */
export type Listening = {
  /** « Plus de questions » : le parcours s'arrête (seules les demandes explicites sont traitées). */
  stopAll: boolean;
  /** Deux refus de suite : plus de question de chiffre dans la session. */
  stopFigures: boolean;
  /** Le dernier message demande si le CV est prêt, ou une confirmation. */
  readiness: boolean;
  confirmation: boolean;
  /** Le dernier message est un refus. */
  refusal: boolean;
  /** Le dernier message demande de raccourcir (au moins 20 % de mots en moins sur le texte visé). */
  shorten: boolean;
  /** CV lié : deux refus de suite à des questions sur des mots-clés de l'offre (absent en mode libre). */
  stopKeywords?: boolean;
};

/**
 * État de la session tiré des messages du candidat (historique, puis dernier message). `offer` :
 * CV lié, mots-clés de l'offre encore absents du CV (arrêt des questions sur les mots-clés).
 */
export function listeningState(
  history: { role: "user" | "assistant"; content: string }[],
  request: string,
  offer?: { keywords: string[] },
): Listening {
  const messages = [...history.filter((t) => t.role === "user").map((t) => t.content), request];
  const stopFigures = messages.some((m, i) => i > 0 && isNegative(m) && isNegative(messages[i - 1]));
  const listening: Listening = {
    stopAll: messages.some(asksToStop),
    stopFigures,
    readiness: isReadinessQuestion(request),
    confirmation: isConfirmationQuestion(request),
    refusal: isNegative(request),
    shorten: asksToShorten(request),
  };
  if (!offer) return listening;
  // Chaque message du candidat avec la question du coach qui le précède.
  const answers: { question: string; answer: string }[] = [];
  let question = "";
  for (const turn of [...history, { role: "user" as const, content: request }]) {
    if (turn.role === "assistant") question = turn.content;
    else {
      answers.push({ question, answer: turn.content });
      question = "";
    }
  }
  const refusedKeyword = (a: { question: string; answer: string }) => isNegative(a.answer) && isKeywordQuestion(a.question, offer.keywords);
  return { ...listening, stopKeywords: answers.some((a, i) => i > 0 && refusedKeyword(a) && refusedKeyword(answers[i - 1])) };
}

/** Phrases d'un texte (une majuscule ou un guillemet ouvre la suivante). */
const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý«"“(])/).filter((s) => s.trim());
const isQuestion = (sentence: string) => /\?\s*[»”")]*\s*$/.test(sentence.trim());

const CLOSURE = /Ton CV est prêt|Your CV is ready|Je n'ai plus de question|I have no more questions/i;
/** Constats écrits par le serveur (coach-outcome.ts) : jamais retirés comme formules répétées. */
const SERVER_STATUS = /^(C'est fait|Done|Pas modifié|Not changed|Je n'ai pas pu|I couldn't|Je n'ai pas modifié|I didn't change|Certaines puces|Some bullets|Une partie|Part of)/;
const normalizeSentence = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const TEXTS = {
  fr: {
    readyYes: (score: number) => `Oui : ton CV est à ${score}/100, au-dessus du seuil de ${READY_SCORE}. Tu peux l'envoyer.`,
    readyNo: (score: number, gaps: string) =>
      `Pas encore : ton CV est à ${score}/100 (seuil de ${READY_SCORE}).${gaps ? ` Ce qui bloque surtout : ${gaps}.` : ""}`,
    stopped: (score: number, gaps: string) =>
      `D'accord, j'arrête les questions.${gaps ? ` Ce qui reste, si tu veux y revenir : ${gaps}.` : ""} Ton CV est à ${score}/100 : tu peux t'arrêter là, ou me demander une modification précise.`,
    closedShort: "Dis-moi si tu veux une modification précise.",
  },
  en: {
    readyYes: (score: number) => `Yes: your CV is at ${score}/100, above the ${READY_SCORE} threshold. You can send it.`,
    // Les corrections du score sont écrites en français : pas de liste en anglais.
    readyNo: (score: number) => `Not yet: your CV is at ${score}/100 (threshold ${READY_SCORE}).`,
    stopped: (score: number) => `OK, I'll stop asking questions. Your CV is at ${score}/100: you can stop here, or ask me for a specific change.`,
    closedShort: "Tell me if you want a specific change.",
  },
};

export type ListenInput = {
  text: string;
  mode: "demande" | "parcours";
  lang: CoachLang;
  listening: Listening;
  /** Score après l'échange, score avant (CV déjà clos ?) et corrections restantes (les plus rentables d'abord). */
  score: number;
  scoreBefore: number;
  corrections: string[];
  /** Messages du coach déjà affichés (historique). */
  previousCoach: string[];
  /** CV lié : mots-clés de l'offre encore absents (questions retirées après deux refus). */
  offerKeywords?: string[];
};

/**
 * Texte affiché, corrigé selon ce que le candidat a dit :
 * - « plus de questions » (parcours) ou deux refus de suite (questions de chiffre) : la phrase-
 *   question est retirée ; si le message n'était qu'une question, résumé de ce qui reste et
 *   proposition de conclure ;
 * - après un refus : pas de « Je continue avec… ? » ;
 * - CV clos : la clôture n'est jamais redite ;
 * - « c'est prêt ? » : réponse directe du serveur (score, ce qui bloque) avant le reste.
 */
export function listenText(i: ListenInput): string {
  const t = TEXTS[i.lang];
  const gaps = i.corrections.slice(0, 2).map((c) => c.replace(/\s*\(\+\d+ pts\)$/, "")).join(" ; ");
  let sentences = splitSentences(i.text);

  // Après un refus : pas de relance pour continuer une demande en cours.
  if (i.listening.refusal) sentences = sentences.filter((s) => !(isQuestion(s) && CONTINUE_OFFER.test(s)));

  // Arrêt des questions : toutes (parcours) après « plus de questions », celles de chiffre après deux refus.
  const dropQuestion = (s: string) =>
    isQuestion(s) &&
    ((i.listening.stopAll && i.mode === "parcours") ||
      (i.listening.stopFigures && FIGURE_QUESTION.test(s)) ||
      (i.listening.stopKeywords === true && isKeywordQuestion(s, i.offerKeywords ?? [])));
  const hadQuestion = sentences.some(dropQuestion);
  sentences = sentences.filter((s) => !dropQuestion(s));

  // CV déjà clos : la clôture n'est pas redite si elle a déjà été affichée.
  const closureSaid = i.previousCoach.some((m) => CLOSURE.test(m));
  if (i.scoreBefore >= READY_SCORE && closureSaid) sentences = sentences.filter((s) => !CLOSURE.test(s));

  // Formule déjà écrite mot pour mot dans un message précédent (« Pas de souci, je n'y reviens
  // plus. ») : retirée. Les constats du serveur (annonce, refus, échec) et les questions restent.
  const said = new Set(i.previousCoach.flatMap(splitSentences).map(normalizeSentence));
  const repeated = (s: string) => !isQuestion(s) && !SERVER_STATUS.test(s) && said.has(normalizeSentence(s));
  if (sentences.some((s) => !repeated(s))) sentences = sentences.filter((s) => !repeated(s));

  let text = sentences.join(" ").trim();
  if (!text) {
    // Le message n'était qu'une question (ou que la clôture déjà dite).
    if (hadQuestion) text = i.lang === "fr" ? TEXTS.fr.stopped(i.score, gaps) : TEXTS.en.stopped(i.score);
    else text = t.closedShort;
  }

  // « C'est prêt ? » : réponse directe d'abord (sauf si le texte donne déjà ce score).
  if (i.listening.readiness && !text.includes(`${i.score}/100`)) {
    const answer = i.score >= READY_SCORE ? t.readyYes(i.score) : i.lang === "fr" ? TEXTS.fr.readyNo(i.score, gaps) : TEXTS.en.readyNo(i.score);
    text = `${answer} ${text}`;
  }
  return text;
}
