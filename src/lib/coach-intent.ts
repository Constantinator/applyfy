import type { CoachLang } from "./coach-outcome";
import { plainCoachText } from "./coach-plain";
import { READY_SCORE } from "./cv-score";

// Le coach écoute (lot « le coach écoute ») : intentions du candidat lues par le serveur dans ses
// messages (question directe, refus, demande d'arrêt), état de la session tiré de l'historique, et
// texte affiché corrigé en conséquence. Tout est décidé par le code : le prompt reçoit seulement
// des phrases fixes (coach-prompt.ts, bloc « situation »).

/**
 * « C'est prêt ? », « Est-ce que ton CV est maintenant prêt ? », « tu peux me dire si mon CV est
 * prêt », « ça suffit pour finaliser ? », « is my CV ready now? » : le serveur répond avec le score.
 * « Est-ce que ça suffit pour reformuler la puce ? » n'en est pas une (run 2026-11-16T03-20-31,
 * L14) : « suffit pour » ne compte que devant postuler, finaliser ou envoyer.
 */
const READINESS =
  /(est-ce (que )?(c'est |mon cv est |il est |le cv est )?(pr[êe]t|bon|fini|termin[ée]|valid[ée])|c'est (pr[êe]t|bon|fini|ok)\s*\?|(mon|ton|le) cv est(-il)? (maintenant |d[ée]sormais |enfin |vraiment )?(pr[êe]t|bon)\s*\?|(peut-on|on peut|je peux|puis-je) (valider|le valider|l'envoyer|envoyer|postuler)|is (it|my cv) (ready|done|good|ok)|can (we|i) (validate|send|apply)|are we done|am i (ready|done))|(est-ce que|tu peux me dire si|peux-tu me dire si|dis-moi si|tu me dis si) (mon|ton|le) cv (est|serait) (maintenant |d[ée]sormais |enfin |vraiment |bien )?(pr[êe]t|bon|fini|ok|suffisant|complet)|est-ce que (ça|c'est|cela) suffi(t|sant)(?!\s+pour (?!postuler|finaliser|l'envoyer|envoyer|candidater))|(ça|cela) suffit(-il)? pour (finaliser|postuler|l'envoyer|envoyer)|reste-t-il (des points|quelque chose|encore)|il reste (des points|quelque chose|encore)[^.?!]*\?|is (my|the) cv (now |finally )?(ready|good enough|done)|is (it|that) enough(?!\s+(to|for) (?!apply|send|submit))|(can you )?tell me if (my|the) cv is ready|anything (else )?left to (fix|do)/i;
/** « Il y a encore des choses à améliorer ? », « tu vois autre chose à changer ? » : pistes concrètes, ou rien d'important. */
const IMPROVE =
  /(encore des (choses|points|trucs) [àa] (am[ée]liorer|changer|corriger)|(un|des) points? (pr[ée]cis )?[àa] am[ée]liorer|qu'est-ce (qui|que je peux|qu'on peut|que tu) (reste|encore)? ?(à )?(am[ée]liorer|changer)|que (reste-t-il|puis-je|peut-on) (encore )?(à )?am[ée]liorer|tu vois (encore )?autre chose (à|de) (changer|am[ée]liorer|corriger)|y a-t-il (encore )?(quelque chose|des choses|un point)[^.?!]{0,20}[àa] (am[ée]liorer|changer|corriger)|(anything|something) (else )?(to|i could|i can|i should) (improve|change)|what else (can|could|should) i (improve|change)|could (it|my cv) be improved)/i;
/**
 * Demande de supprimer, fusionner ou remplacer (une puce, un élément) : seule autorisation d'une
 * suppression (« supprime la puce sur les réunions », « fusionne ces deux puces »). « Je retire 40
 * dossiers par mois » (un fait) n'en est pas une.
 */
const REMOVE =
  /\b(supprime|supprimes|supprimez|supprimer|enl[èe]ve|enlevez|enlever|retire|retirez|retirer|efface|effacez|effacer|fusionne|fusionnez|fusionner|regroupe|regroupez|regrouper|remplace|remplacez|remplacer)\b[^.?!]{0,40}\b(puces?|lignes?|exp[ée]riences?|formations?|projets?|doublons?|les deux|ces deux|celle|celles|la|les|l'|ça|cela)\b|\b(remove|delete|drop|merge|combine|replace)\b[^.?!]{0,40}\b(bullets?|lines?|points?|experiences?|entries|entry|projects?|both|these|those|it|them|duplicates?)\b|\bget rid of\b/i;
/**
 * Pronom placé avant le verbe (« Tu peux la supprimer », « Peux-tu les retirer ? », run
 * 2026-11-16T05-00-26, L02 tour 9) : REMOVE ne lit que le verbe suivi de son objet.
 */
const REMOVE_PRONOUN =
  /\b(tu peux|peux-tu|tu pourrais|pourrais-tu|vous pouvez|pouvez-vous|n'h[ée]site pas [àa])\s+(la|le|les|l')\s*(supprimer|retirer|enlever|effacer)\b/i;
/** Refus de la suppression (« ne la supprime pas », « pas la supprimer », « garde-la », « laisse-la »). */
const NOT_REMOVE =
  /\bne\s+(la|le|les|l')\s*(supprime|retire|enl[èe]ve|efface)\w*\s+pas\b|\bpas\s+(la|le|les|l')\s*(supprimer|retirer|enlever|effacer)\b|\b(garde|gardez|laisse|laissez)-(la|le|les)\b/i;
/** Fait raconté avec un de ces verbes (« je retire 40 dossiers », « j'ai fusionné deux équipes ») : pas une demande. */
const REMOVE_FACT = /\b(je|j'|on|nous|il|elle|i|we)\s*(retire|retirais|retirons|ai (retiré|fusionné|regroupé|supprimé|remplacé)|avons|merged|removed|replaced)\b/i;
/** Le coach propose une suppression ou une fusion, en question (« Veux-tu que je supprime la puce … ? »). */
const PROPOSES_REMOVAL =
  /(veux-tu|souhaites-tu|tu veux|est-ce que tu veux|je (peux|propose de|te propose de))[^?]{0,40}\b(supprime[rs]?|retire[rs]?|enl[èe]ve[rs]?|fusionne[rs]?|regroupe[rs]?)\b[^?]*\?|\b(shall|should|can) i (remove|delete|merge|combine)\b[^?]*\?|\bdo you want me to (remove|delete|merge|combine)\b[^?]*\?/i;
/** Réponse affirmative courte, éventuellement après une interjection (« Ah oui, … », L02 tour 9). */
const AFFIRMATIVE = /^\s*((ah|oh|bon|alors|euh|ben|bah|eh bien)\s*,?\s*)?(oui|ouais|d'accord|ok|okay|vas-y|go|yes|yep|yeah|sure|parfait|c'est bon|bien sûr|of course)\b/i;

/** Le dernier message demande de supprimer, fusionner ou remplacer. */
export const asksToRemove = (message: string) =>
  (REMOVE.test(message) || REMOVE_PRONOUN.test(message)) && !REMOVE_FACT.test(message) && !NOT_REMOVE.test(message);
/** Le message du coach propose une suppression ou une fusion. */
export const proposesRemoval = (coachMessage: string) => PROPOSES_REMOVAL.test(coachMessage);
/**
 * Suppression autorisée : demandée dans le dernier message, ou acceptée (« oui », « ok », « yes »)
 * quand la dernière question du coach la proposait. « Oui, en mars » après « Veux-tu que je
 * supprime X ? Et à quel mois… ? » répond à la question de mois : rien n'est supprimé.
 */
export function removalAllowed(history: { role: "user" | "assistant"; content: string }[], request: string): boolean {
  if (asksToRemove(request)) return true;
  return lastQuestionProposesRemoval(history) && AFFIRMATIVE.test(request) && !isNegative(request) && !NOT_REMOVE.test(request);
}
const lastQuestionProposesRemoval = (history: { role: "user" | "assistant"; content: string }[]) => {
  const lastCoach = [...history].reverse().find((t) => t.role === "assistant")?.content ?? "";
  return proposesRemoval(splitSentences(lastCoach).filter(isQuestion).pop() ?? "");
};
/**
 * La dernière question du coach proposait la suppression et le candidat ne l'a pas refusée : si la
 * suppression est quand même refusée, le message demande un oui ou un non (lot E, 1d), au lieu de
 * « je ne supprime que si tu me le demandes », faux après une proposition du coach.
 */
export const removalProposed = (history: { role: "user" | "assistant"; content: string }[], request: string) =>
  lastQuestionProposesRemoval(history) && !isNegative(request) && !NOT_REMOVE.test(request);

/** « Peux-tu confirmer… ? », « can you confirm…? » : le coach répond d'abord oui ou non. */
const CONFIRMATION = /((peux|pourrais)-tu|tu (peux|pourrais)|pouvez-vous) (me )?confirmer|can you confirm|could you confirm/i;
/** Refus ou « je ne sais pas ». */
const NEGATIVE =
  /^\s*(non|nan|no|nope)\b|je (ne )?sais pas|jsp\b|aucune id[ée]e|je (ne )?(me )?souviens (pas|plus)|je n'ai pas (ce|le|de|cette|l'|d')|pas de chiffre|je (ne )?connais (pas|ni)|je pr[ée]f[èe]re ne (pas|rien)|je ne (peux|pourrais) pas (te )?(le |la |les )?(donner|confirmer|dire|pr[ée]ciser)|pas en t[êe]te|je n'en sais rien|i don'?t know|no idea|i don'?t (have|remember|recall)|not sure|i'?d rather not|i can'?t (give|confirm|say|tell)/i;
/** Fin de la réponse à la question : ce qui suit est un autre fait (« Par contre, j'ai 80 clients »). */
const CONTRAST = /\s(mais|par contre|en revanche|cependant|je sais (seulement|juste)|but|however|though|i only know)\b|[;:]/i;
/** Nombre qui répond à une question (une année seule, « en 2023 », n'en est pas un). */
const ANSWER_NUMBER = /\b(?!(?:19|20)\d\d\b)\d+/;
/**
 * Demande d'arrêt des questions, ou de la session (« je m'arrête là », « tu peux le finaliser »,
 * « puis on en reste là » : run 2026-11-15T23-04-28, O06). « On en reste là pour le résumé » ou
 * « on en reste là ? » n'en sont pas.
 */
const STOP =
  /plus (de|aucune) questions?|arr[êe]te (les|tes) questions|stop (les|tes|the|asking|with the) questions?|pas d'autres? questions?|no more questions|stop asking|\bon (peut|pourra|pourrait) (s'arr[êe]ter|finir|conclure|en rester) (là|ici)(?![a-zà-ÿ])|\b(si on peut|on peut) finir l[àa]-dessus\b|\bje m'arr[êe]te (là|ici)(?![a-zà-ÿ])|\btu peux le finaliser\b|\b(le|mon) cv me convient\b|\b(on en reste|restons-en|on s'arr[êe]te) (là|ici)(?![a-zà-ÿ])(?!\s*\?)(?!\s*,?\s*(pour|sur|avec|concernant)\s+(?!aujourd'hui|l'instant|le moment|maintenant|ce soir)\S)|\bwe can (stop|finish|wrap up)\b|\blet'?s (stop|wrap up)\b|\bi'?m done\b|\bi'?ll stop (here|there)\b/i;
/**
 * Arrêt limité au point en cours (run 2026-11-16T02-55-59, L14 : « donc je m'arrête là sur ce
 * point ») : ce n'est pas un arrêt de la session. Retiré du message avant de chercher STOP, pour
 * qu'une vraie demande d'arrêt dans le même message (« … Plus de questions. ») compte toujours.
 */
const STOP_ON_POINT =
  /\b(je m'arr[êe]te|on s'arr[êe]te|on en reste|restons-en|on (peut|pourra|pourrait) (s'arr[êe]ter|en rester)|i'?ll stop|let'?s stop|we can stop|i'?m done)(\s+(là|ici|here|there))?\s*,?\s*(sur ce point|pour ce point|l[àa]-dessus|sur cette question|pour cette question|sur [çc]a|sur cela|on (that|this) (point|one|question)|for (that|this) (point|one|question))(?![\p{L}])/giu;

/** « Je m'arrête là » qui ne vaut qu'après une action (« do it now, then I'm done ») : pas un arrêt. */
const AFTER_ACTION = /\b(then|et après|ensuite|puis|after that)\s*,?\s*(i'?m done|im done|je m'arr[êe]te)/i;
/** Arrêt sous condition explicite : « on pourra s'arrêter là si ton CV est prêt », « if it's ready, we can stop ». */
const STOP_IF_READY =
  /\b(arr[êe]ter|finir|conclure|en rester)\b[^.?!]{0,20}\bsi\b[^.?!]{0,40}\b(pr[êe]t|bon|suffit)\b|\bsi (ton|mon|le) cv est pr[êe]t\b[^.?!]{0,40}\b(arr[êe]ter|finir|conclure|en rester)\b|\bif (it'?s ready|(my|the) cv is ready)\b[^.?!]{0,40}\b(stop|finish|wrap up|done)\b|\b(stop|finish|wrap up)\b[^.?!]{0,20}\bif (it'?s|(my|the) cv is) ready\b/i;
/**
 * Arrêt sous condition d'un « oui » (« Si oui, on peut s'arrêter là », « if yes im done ») : ne vaut
 * « prêt ? » que si le message demande aussi si le CV est prêt (sinon le oui porte sur autre chose,
 * par exemple la langue du CV : run 2026-11-15T23-04-28, L17).
 */
const STOP_IF_YES =
  /\b(arr[êe]ter|finir|conclure|en rester)\b[^.?!]{0,20}\bsi c'est le cas\b|\bsi (oui|c'est (bon|le cas))\b[^.?!]{0,40}\b(arr[êe]ter?|finir|conclure|en rester)\b|\bif (so|yes)\b[^.?!]{0,40}\b(stop|finish|wrap up|done)\b/i;
/**
 * Demande de raccourcir un texte : une demande, jamais un fait raconté (« mon modèle a réduit la
 * clôture ») ni une négation (« je n'ai pas demandé de raccourcir »).
 */
const SHORTEN =
  /\b(raccourcis|raccourcir|raccourcissez)\b|\b(fais|rends|écris|r[ée]dige|mets)[- ]?(le|la|les|-le|-la|-les)? ?(un peu )?plus court|\bversion (plus courte|courte)\b|\bplus courte? (stp|svp|s'il te pla[îi]t)|\b(est|sont|c'est|reste|restent) (un peu |beaucoup )?trop longu?e?s?\b|\b(condense|condenser|condensez|all[èe]ge|all[ée]ger|all[ée]gez)\b|\br[ée]dui(s|re|sez) (la longueur|le nombre de mots|mon|ma|mes|le|la|les|l'|ce|cette|ces|ça)\b|\b(shorten|condense)\b|\bmake (it|this|that|them|my [\w-]+|the [\w-]+) (shorter|short|more concise)\b|\b(too long|more concise|shorter version|a bit shorter|cut it down)\b|\btrim (it|this|my|the)\b/i;
/** Négation d'une demande de raccourcir. */
const NOT_SHORTEN =
  /\bpas (demand[ée] (de |à )?|besoin (de )?|voulu |de )?(raccourci|r[ée]dui)|\bne (le |la |les )?(raccourcis|r[ée]duis) pas\b|\bsans (le |la |les )?(raccourcir|r[ée]duire)\b|\baucune r[ée]duction\b|\b(don'?t|do not|not|no need to|never asked (you )?to) (shorten|trim|cut)\b/i;

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
/**
 * « Sans chiffre » n'est pas une demande de chiffre (run 2026-11-16T03-20-31, L14 : « tu veux que je
 * la reformule maintenant, sans chiffre ? » retirée après deux refus de chiffre) : retiré avant de
 * chercher un mot de chiffre.
 */
const NO_FIGURE_WORDS = /\bsans (aucun )?chiffres?\b|\bwithout (any )?(numbers?|figures?)\b/gi;
/** La phrase demande un chiffre (mots stricts : combien, chiffre, nombre…). */
const asksFigureWord = (text: string) => FIGURE_QUESTION.test(text.replace(NO_FIGURE_WORDS, " "));
/** Proposition de continuer une demande en plusieurs parties. */
const CONTINUE_OFFER = /je continue avec|veux-tu que je continue|on continue avec|je passe à .*\?|shall i continue|should i continue|do you want me to continue|i'?ll continue with/i;

export const isReadinessQuestion = (message: string) => READINESS.test(message);
export const isConfirmationQuestion = (message: string) => CONFIRMATION.test(message);

/**
 * Question ouverte du candidat, qui appelle un conseil ou une explication (« comment les formuler ? »,
 * « tu me conseilles… ? », « qu'en penses-tu ? », « how should I…? ») : une phrase terminée par « ? ».
 */
const OPEN_QUESTION =
  /\b(comment|pourquoi|conseill(es|erais)|qu'en penses-tu|tu en penses quoi|qu'est-ce que tu en penses|vaut-il mieux|vaut mieux|lequel|laquelle|lesquels|lesquelles|o[ùu] (le |la |les )?(mettre|placer)|how|why|should i|what do you (think|suggest|recommend)|which|would you (recommend|suggest)|where should)\b/i;
/**
 * Doute du candidat sur un fait (« je crois que c'était », « environ », « pas certain », « I think »,
 * « not sure »). « Je pense que ça me va » (une opinion) ou « tell me about » n'en sont pas :
 * « about », « around » ne comptent que devant un nombre.
 */
const DOUBT =
  /\b(je crois|je dirais|il me semble|environ|[àa] peu pr[èe]s|plus ou moins|approximativement|grosso modo|peut-[êe]tre|je ne suis (pas|plus) (tr[èe]s |vraiment )?(s[ûu]re?|certaine?)|pas (tr[èe]s |vraiment )?(s[ûu]re?|certaine?) (du|de|des|que)|si je me souviens( bien)?|de m[ée]moire|i think|i believe|i'?d say|not (really |quite )?sure|roughly|maybe|perhaps|approximately|i guess|more or less|or so|if i remember|(about|around) \d)/i;
export const expressesDoubt = (message: string) => DOUBT.test(message);

/**
 * Demande de première personne (« garde le « je » », « à la première personne », « keep it in the
 * first person », « use "I" ») : seule exception au refus de « je / mon / mes » en mode demande.
 */
const FIRST_PERSON =
  /premi[èe]re personne|\b1(re|[èe]re) personne|\b(garde|gardes|garder|gardez|utilise|utiliser|utilisez|mets|mettre|avec|en disant|[ée]cris|[ée]crire)\b[^.?!]{0,20}[«"“]\s*(je|j'|mon|ma|mes)\s*[»"”]|first[- ]person|\b(keep|use|using|with|write)\b[^.?!]{0,20}["“]\s*(i|my|me)\s*["”]/i;
export const asksFirstPerson = (message: string) => FIRST_PERSON.test(message);

/**
 * Le dernier message pose une question ouverte. « Prêt ? », « que reste-t-il ? » et « peux-tu
 * confirmer ? » ont déjà leur réponse du serveur : ils n'en sont pas.
 */
export function asksOpenQuestion(message: string): boolean {
  if (isReadinessQuestion(message) || asksWhatToImprove(message) || isConfirmationQuestion(message)) return false;
  return splitSentences(message).some((s) => isQuestion(s) && OPEN_QUESTION.test(s));
}
export const asksWhatToImprove = (message: string) => IMPROVE.test(message);
/**
 * Réponse négative à la question posée : refus ou information inconnue au début du message, sans
 * nombre qui y réponde. Un autre fait donné ensuite (« Par contre, j'ai 80 clients ») ou une année
 * (« commencé en 2023, mais… ») n'en fait pas une réponse.
 */
export function isNegative(message: string): boolean {
  const first = message.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const answer = first.split(CONTRAST)[0] ?? "";
  return NEGATIVE.test(answer) && !ANSWER_NUMBER.test(answer);
}
/** Arrêt sous condition (« si ton CV est prêt ») : réponse sur le score, pas de nouvelle question à ce message. */
export const asksToStopIfReady = (message: string) =>
  STOP_IF_READY.test(message) || (STOP_IF_YES.test(message) && isReadinessQuestion(message));
/** Un arrêt sous condition (prêt, ou « si oui ») n'est jamais un arrêt de la session. */
export const asksToStop = (message: string) => {
  const text = message.replace(STOP_ON_POINT, " ");
  return STOP.test(text) && !AFTER_ACTION.test(text) && !STOP_IF_READY.test(text) && !STOP_IF_YES.test(text);
};

/** Question de chiffre au sens large (montant, volume, taux) pour le type de question. */
const FIGURE_LIKE = /montant|volume|taux|chiffre d'affaires|encours|fr[ée]quence|amount|volume|rate|revenue/i;
const isFigureQuestion = (text: string) => asksFigureWord(text) || FIGURE_LIKE.test(text.replace(NO_FIGURE_WORDS, " "));

/** Type d'une question du coach : ce que deux refus de suite arrêtent. */
export type QuestionType = "mois" | "outil" | "chiffre" | "detail";
const MONTH_QUESTION =
  /(quels? mois|[àa] quel mois|de quel mois|en quel mois|les mois|mois (exacts?|de (d[ée]but|fin))|dates? (exactes?|pr[ée]cises?)|which month|what month|start (date|month)|end (date|month)|exact dates?)/i;
const TOOL_QUESTION = /\b(outils?|logiciels?|crm|erp|plateformes?|tools?|software|platforms?)\b|as-tu (d[ée]j[àa] )?utilis|have you (ever )?used/i;
/** Type de la dernière question d'un message du coach ; null s'il n'en pose pas. */
export function questionType(text: string): QuestionType | null {
  const question = splitSentences(text).filter(isQuestion).pop();
  if (!question) return null;
  if (MONTH_QUESTION.test(question)) return "mois";
  if (TOOL_QUESTION.test(question)) return "outil";
  if (isFigureQuestion(question)) return "chiffre";
  return "detail";
}
/** Le message du coach pose une question sur les mois des dates (dans n'importe laquelle de ses phrases-questions). */
export const asksMonths = (text: string) => splitSentences(text).some((s) => isQuestion(s) && MONTH_QUESTION.test(s));
/** Le candidat demande d'ajouter ou de préciser les mois de ses dates (« tu peux ajouter les mois »). */
const MONTH_REQUEST =
  /\b(ajoute[rz]?|pr[ée]cise[rz]?|mets|mettre|mettez|indique[rz]?|compl[èe]te[rz]?|add|include|put)\b[^.?!]{0,30}\b(mois|dates?|months?)\b/i;
/** Type d'une phrase-question (pour la retirer). */
const sentenceType = (sentence: string): QuestionType =>
  MONTH_QUESTION.test(sentence) ? "mois" : TOOL_QUESTION.test(sentence) ? "outil" : isFigureQuestion(sentence) ? "chiffre" : "detail";
export const asksToShorten = (message: string) => SHORTEN.test(message) && !NOT_SHORTEN.test(message);

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
  /**
   * CV lié : le coach a déjà posé KEYWORD_QUESTIONS_MAX questions sur des mots-clés de l'offre
   * (comptées sur tous ses mots-clés, même intégrés depuis) : il n'en pose plus. Absent sinon.
   */
  keywordsDone?: boolean;
  /**
   * Deux refus de suite, quel que soit le type de question : types des questions refusées dans la
   * session (le coach n'en repose plus ; il propose de conclure ou passe à un autre élément).
   * Absent sans deux refus de suite.
   */
  stopTypes?: QuestionType[];
  /** Le candidat a dit une fois ne pas connaître les mois de ses dates. Absent sinon. */
  stopMonths?: boolean;
  /**
   * Une question sur les mois des dates a déjà été posée (réponse donnée ou non), sans refus : le
   * coach n'en pose plus, pour aucun poste, sauf si le dernier message demande d'ajouter les mois.
   * Absent sinon.
   */
  monthsAsked?: boolean;
  /**
   * Le dernier message du coach posait la question de mois : ce message y répond (mois donnés,
   * même avec un doute, ou année gardée). Jamais en même temps que monthsAsked. Absent sinon.
   */
  monthsAnswer?: boolean;
  /** Le dernier message demande de s'arrêter si le CV est prêt. Absent sinon. */
  stopIfReady?: boolean;
  /** Le dernier message demande ce qu'il reste à améliorer. Absent sinon. */
  improve?: boolean;
  /** Le dernier message pose une question ouverte (conseil, explication). Absent sinon. */
  openQuestion?: boolean;
  /** Le dernier message exprime un doute sur un fait (« je crois », « environ », « I think »). Absent sinon. */
  uncertain?: boolean;
  /**
   * Le dernier message répond à une question de chiffre avec des faits, en disant ne pas avoir le
   * chiffre (« je gérais le planning… Je ne connais pas le budget ») : une puce peut rester sans
   * chiffre, sans aucun nombre inventé. Absent sinon (et pour un simple « je ne sais pas »).
   */
  noFigure?: boolean;
};

/**
 * État de la session tiré des messages du candidat (historique, puis dernier message). `offer` :
 * CV lié, mots-clés de l'offre encore absents du CV (arrêt des questions sur les mots-clés).
 */
export function listeningState(
  history: { role: "user" | "assistant"; content: string }[],
  request: string,
  offer?: { keywords: string[]; allKeywords?: string[] },
): Listening {
  const messages = [...history.filter((t) => t.role === "user").map((t) => t.content), request];
  const stopFigures = messages.some((m, i) => i > 0 && isNegative(m) && isNegative(messages[i - 1]));
  const stopIfReady = asksToStopIfReady(request);
  const listening: Listening = {
    stopAll: messages.some(asksToStop),
    stopFigures,
    readiness: isReadinessQuestion(request) || stopIfReady,
    confirmation: isConfirmationQuestion(request),
    refusal: isNegative(request),
    shorten: asksToShorten(request),
  };
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
  // Refus par type de question : mois refusés une fois (toute phrase-question du message du coach,
  // pas seulement la dernière) ; deux refus de suite, quel que soit le type.
  const refused = answers.map((a) => (isNegative(a.answer) ? questionType(a.question) : null));
  if (answers.some((a) => isNegative(a.answer) && asksMonths(a.question))) listening.stopMonths = true;
  // Ce message répond à la question de mois (dernier message du coach) : consigne de ce tour, et
  // monthsAsked seulement si une question de mois avait déjà été posée avant.
  const last = history.at(-1);
  const answering = last?.role === "assistant" && asksMonths(last.content);
  if (answering) listening.monthsAnswer = true;
  const earlier = answering ? history.slice(0, -1) : history;
  // Question de mois déjà posée, sans refus : une seule fois par CV (sauf demande d'ajouter les mois).
  if (!listening.stopMonths && earlier.some((t) => t.role === "assistant" && asksMonths(t.content)) && !MONTH_REQUEST.test(request)) {
    listening.monthsAsked = true;
    delete listening.monthsAnswer;
  }
  const twoInARow = answers.some((a, i) => i > 0 && isNegative(a.answer) && isNegative(answers[i - 1].answer));
  if (twoInARow) listening.stopTypes = [...new Set(refused.filter((t): t is QuestionType => t !== null))];
  if (stopIfReady) listening.stopIfReady = true;
  if (asksWhatToImprove(request)) listening.improve = true;
  if (asksOpenQuestion(request)) listening.openQuestion = true;
  if (expressesDoubt(request)) listening.uncertain = true;
  if (saysNoFigure(history, request)) listening.noFigure = true;
  if (!offer) return listening;
  const refusedKeyword = (a: { question: string; answer: string }) => isNegative(a.answer) && isKeywordQuestion(a.question, offer.keywords);
  const stopKeywords = answers.some((a, i) => i > 0 && refusedKeyword(a) && refusedKeyword(answers[i - 1]));
  // Plafond imposé par le serveur : messages du coach qui posent une question sur un mot-clé de l'offre.
  const all = offer.allKeywords?.length ? offer.allKeywords : offer.keywords;
  const asked = history.filter(
    (t) => t.role === "assistant" && splitSentences(t.content).some((s) => isQuestion(s) && isKeywordQuestion(s, all)),
  ).length;
  return { ...listening, stopKeywords, ...(asked >= KEYWORD_QUESTIONS_MAX ? { keywordsDone: true } : {}) };
}

/** Questions du coach sur les mots-clés de l'offre, au plus, dans une session (« 4 au maximum » du prompt). */
export const KEYWORD_QUESTIONS_MAX = 4;

/**
 * Le candidat dit ne pas avoir le chiffre demandé (« je ne connais pas le budget », « pas de
 * chiffre », « I don't have the exact number »), n'importe où dans son message.
 */
const FIGURE_REFUSAL =
  /\bpas de chiffres?\b|\baucun chiffre\b|\bje (ne )?(connais|sais) (pas|plus) (exactement |pr[ée]cis[ée]ment )?(le |la |les |l'|leur |leurs )?(nombre|budget|montant|chiffre|taux|volume|fr[ée]quence|pourcentage|dur[ée]e)|\bje (ne )?sais (pas|plus) combien\b|\bje n'ai pas (le |les |de |d')?(chiffres?|nombres?|donn[ée]es chiffr[ée]es)\b|\bje ne (peux|pourrais) pas (te )?(donner|dire) (le |de |un |d')?(chiffre|nombre|ordre de grandeur)|\bi don'?t (know|have|remember) (the |any |an |exact )*(numbers?|figures?|budget|amount|count|how many)\b|\bno (exact )?(figures?|numbers?)\b/i;
/**
 * Puce sans chiffre permise : la dernière question du coach demandait un chiffre (dans n'importe
 * laquelle de ses phrases-questions), et le candidat répond avec des faits en disant ne pas avoir
 * ce chiffre. Une simple négation (« je ne sais pas ») n'en est pas une : le point est abandonné.
 */
function saysNoFigure(history: { role: "user" | "assistant"; content: string }[], request: string): boolean {
  const last = history.at(-1);
  if (last?.role !== "assistant") return false;
  const asked = splitSentences(last.content).some((s) => isQuestion(s) && isFigureQuestion(s));
  return asked && FIGURE_REFUSAL.test(request) && !isNegative(request);
}

/**
 * La phrase demande un chiffre : un mot de chiffre strict (combien, chiffre, nombre, %, budget…), ou
 * un mot de chiffre large (fréquence, taux, volume…) hors question d'outil (« sur quels outils ou
 * fréquence de reporting ? » n'en demande pas : run 2026-11-16T03-20-31, L14).
 */
const asksFigure = (sentence: string) =>
  asksFigureWord(sentence) || (FIGURE_LIKE.test(sentence.replace(NO_FIGURE_WORDS, " ")) && !TOOL_QUESTION.test(sentence));
/**
 * Mode parcours, puce sans chiffre permise (comme noFigure) : le dernier message du coach pose au
 * moins une question et aucune ne demande de chiffre (outils, détails, contexte), et le candidat
 * répond sans refuser. Les nombres restent limités à ceux du CV et des messages du candidat, une
 * seule puce peut rester sans chiffre et le verbe d'action reste exigé (coach-proposals.ts).
 */
export function figureNotAsked(history: { role: "user" | "assistant"; content: string }[], request: string): boolean {
  const last = history.at(-1);
  if (last?.role !== "assistant") return false;
  const questions = splitSentences(last.content).filter(isQuestion);
  return questions.length > 0 && !questions.some(asksFigure) && (!isNegative(request) || laterFacts(request));
}
/**
 * Réponse partielle à une question en plusieurs parties : la première phrase refuse un élément
 * (« Je ne connais pas les secteurs… »), une phrase suivante, non négative et d'au moins 6 mots,
 * répond au reste (« Pour les tests, j'utilisais surtout Excel… » : run 2026-11-16T05-00-26, L11
 * tour 4). « Je ne sais pas. Je vais vérifier ce soir. » (5 mots) n'en est pas une.
 */
const LATER_FACTS_MIN_WORDS = 6;
function laterFacts(message: string): boolean {
  const later = message.trim().split(/(?<=[.!?])\s/).slice(1);
  return later.some((s) => !isNegative(s) && s.split(/\s+/).filter(Boolean).length >= LATER_FACTS_MIN_WORDS);
}

/** Phrases d'un texte (une majuscule ou un guillemet ouvre la suivante). */
const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý«"“(])/).filter((s) => s.trim());
const isQuestion = (sentence: string) => /\?\s*[»”")]*\s*$/.test(sentence.trim());

/** Correction du score sur les dates (« Dates sans mois ou incomplètes — … ») : jamais citée comme point suivant. */
const DATE_CORRECTION = /^(Dates sans mois|Date de fin avant)/;
const CLOSURE = /Ton CV est prêt|Your CV is ready|Je n'ai plus de question|I have no more questions/i;
/** Phrase qui renvoie la question au candidat au lieu d'y répondre. */
const NON_ANSWER = /^(Dis-moi si tu veux une modification précise|Tell me if you want a specific change)/i;
/** Constats écrits par le serveur (coach-outcome.ts) : jamais retirés comme formules répétées. */
const SERVER_STATUS = /^(C'est fait|Done|Pas modifié|Not changed|Je n'ai pas pu|I couldn't|Je n'ai pas modifié|I didn't change|Certaines puces|Some bullets|Une partie|Part of)/;
/** Réponse du modèle à « prêt ? » en tête de phrase : le serveur a déjà répondu. */
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MODEL_READINESS = /^\s*(pas (tout [àa] fait|encore)|not (yet|quite))\s*[:,]\s*/i;
const normalizeSentence = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const TEXTS = {
  fr: {
    readyYes: (score: number) => `Oui : ton CV est à ${score}/100, au-dessus du seuil de ${READY_SCORE}. Tu peux l'envoyer.`,
    readyNo: (score: number, gaps: string) =>
      `Pas encore : ton CV est à ${score}/100 (seuil de ${READY_SCORE}).${gaps ? ` Ce qui bloque surtout : ${gaps}.` : ""}`,
    stopped: (score: number, gaps: string) =>
      `D'accord, j'arrête les questions.${gaps ? ` Ce qui reste, si tu veux y revenir : ${gaps}.` : ""} Ton CV est à ${score}/100 : tu peux t'arrêter là, ou me demander une modification précise.`,
    noInsist: (score: number) => `Pas de souci, je n'insiste pas. Ton CV est à ${score}/100 : tu peux t'arrêter là, ou me demander une modification précise.`,
    stopIfReady: "Tu peux t'arrêter là, ou me dire si tu veux continuer.",
    closedShort: "Dis-moi si tu veux une modification précise.",
    noMoreMonths: "Je ne te redemande pas les mois de tes dates.",
    nextPoint: (point: string) => `On passe au point suivant : ${point}.`,
    allDone:
      "J'ai fait le tour des points à corriger. Tu peux encore modifier ton CV directement en cliquant sur n'importe quel texte dans l'aperçu, ou me demander une modification précise.",
    hints: (hints: string) => `Deux pistes facultatives, sans urgence : ${hints}.`,
    hint: (hint: string) => `Une piste facultative, sans urgence : ${hint}.`,
    nothingImportant: "Je ne vois rien d'important à changer : ton CV couvre déjà l'essentiel. Tu peux encore affiner un texte en cliquant dessus dans l'aperçu.",
  },
  en: {
    readyYes: (score: number) => `Yes: your CV is at ${score}/100, above the ${READY_SCORE} threshold. You can send it.`,
    // Les corrections du score sont écrites en français : pas de liste en anglais.
    readyNo: (score: number) => `Not yet: your CV is at ${score}/100 (threshold ${READY_SCORE}).`,
    stopped: (score: number) => `OK, I'll stop asking questions. Your CV is at ${score}/100: you can stop here, or ask me for a specific change.`,
    noInsist: (score: number) => `No problem, I won't insist. Your CV is at ${score}/100: you can stop here, or ask me for a specific change.`,
    stopIfReady: "You can stop here, or tell me if you want to continue.",
    closedShort: "Tell me if you want a specific change.",
    // Les corrections du score sont écrites en français : pas de point cité en anglais.
    noMoreMonths: "I won't ask about the months of your dates again.",
    nextPoint: () => "Let's move on: the next point is listed under your score.",
    allDone: "I've gone through the points to fix. You can still edit your CV by clicking any text in the preview, or ask me for a specific change.",
    // Les corrections du score sont écrites en français : pas de liste en anglais.
    hints: () => "A few optional improvements remain, with no urgency: they are listed under your score.",
    hint: () => "One optional improvement remains, with no urgency: it is listed under your score.",
    nothingImportant: "I don't see anything important left to change: your CV already covers the essentials. You can still refine any text by clicking it in the preview.",
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
  /**
   * Le dernier message du candidat demande l'arrêt (`asksToStop`) : en mode demande aussi, les
   * questions du modèle sont retirées de ce message, sauf la proposition de continuer une demande
   * en cours. Seules les phrases de `modelMessage` (message du modèle) sont concernées : jamais un
   * texte du serveur (annonce, échec, score, clôture, question du chiffre manquant).
   */
  stopNow?: boolean;
  modelMessage?: string;
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

  // Arrêt des questions : toutes (parcours) après « plus de questions » ou « je m'arrête si c'est
  // prêt », celles de chiffre après deux refus, celles des types refusés après deux refus de suite,
  // celles sur les mois après un refus.
  const stopAll = (i.listening.stopAll || i.listening.stopIfReady === true) && i.mode === "parcours";
  const refusedType = (s: string) =>
    (i.listening.stopTypes?.includes(sentenceType(s)) ?? false) ||
    ((i.listening.stopMonths === true || i.listening.monthsAsked === true || i.listening.monthsAnswer === true) && sentenceType(s) === "mois");
  const modelQuestions = new Set(splitSentences(i.modelMessage ?? "").filter(isQuestion).map(normalizeSentence));
  const stoppedNow = (s: string) =>
    i.stopNow === true && i.mode === "demande" && !CONTINUE_OFFER.test(s) && modelQuestions.has(normalizeSentence(s));
  const dropQuestion = (s: string) =>
    isQuestion(s) &&
    (stopAll ||
      stoppedNow(s) ||
      (i.listening.stopFigures && asksFigureWord(s)) ||
      ((i.listening.stopKeywords === true || i.listening.keywordsDone === true) && isKeywordQuestion(s, i.offerKeywords ?? [])) ||
      refusedType(s));
  const hadQuestion = sentences.some(dropQuestion);
  // Seulement une question de mois déjà posée une fois (sans refus du candidat) : rien à « ne pas
  // insister », le parcours enchaîne sur le point suivant.
  const monthsOnce = (s: string) =>
    (i.listening.monthsAsked === true || i.listening.monthsAnswer === true) &&
    !i.listening.stopMonths &&
    sentenceType(s) === "mois" &&
    !(i.listening.stopTypes?.includes("mois") ?? false) &&
    !(i.listening.stopFigures && asksFigureWord(s)) &&
    !stoppedNow(s);
  // Question sur un mot-clé retirée par le seul plafond (sans deux refus de suite) : idem.
  const keywordCap = (s: string) =>
    i.listening.keywordsDone === true &&
    !i.listening.stopKeywords &&
    isKeywordQuestion(s, i.offerKeywords ?? []) &&
    !refusedType(s) &&
    !(i.listening.stopFigures && asksFigureWord(s)) &&
    !stoppedNow(s);
  const dropped = sentences.filter(dropQuestion);
  const onlyCapped = !stopAll && hadQuestion && dropped.every((s) => monthsOnce(s) || keywordCap(s));
  const monthsDropped = dropped.some(monthsOnce);
  const onlyRefused = !stopAll && sentences.filter(dropQuestion).every((s) => refusedType(s) && !(i.listening.stopFigures && asksFigureWord(s)));
  sentences = sentences.filter((s) => !dropQuestion(s));

  // CV déjà clos : la clôture n'est pas redite si elle a déjà été affichée.
  const closureSaid = i.previousCoach.some((m) => CLOSURE.test(m));
  if (i.scoreBefore >= READY_SCORE && closureSaid) sentences = sentences.filter((s) => !CLOSURE.test(s));

  // CV clos et « que reste-t-il à améliorer ? » : ni « prêt » redit, ni « Dis-moi si tu veux une
  // modification précise » à la place d'une réponse ; pistes du serveur si le modèle n'en donne pas.
  const improveClosed = i.listening.improve === true && i.scoreBefore >= READY_SCORE;
  if (improveClosed) sentences = sentences.filter((s) => !CLOSURE.test(s) && !NON_ANSWER.test(s));

  // Formule déjà écrite mot pour mot dans un message précédent (« Pas de souci, je n'y reviens
  // plus. ») : retirée. Les constats du serveur (annonce, refus, échec) et les questions restent.
  const said = new Set(i.previousCoach.flatMap(splitSentences).map(normalizeSentence));
  const repeated = (s: string) => !isQuestion(s) && !SERVER_STATUS.test(s) && said.has(normalizeSentence(s));
  if (sentences.some((s) => !repeated(s))) sentences = sentences.filter((s) => !repeated(s));

  let text = sentences.join(" ").trim();
  if (!text && improveClosed) {
    const hints = i.corrections.slice(0, 2).map((c) => c.replace(/\s*\(\+\d+ pts\)$/, ""));
    text = hints.length === 2 ? t.hints(hints.join(" ; ")) : hints.length === 1 ? t.hint(hints[0]) : t.nothingImportant;
  }
  if (!text) {
    // Le message n'était qu'une question (ou que la clôture déjà dite).
    if (i.listening.stopIfReady && i.mode === "parcours") text = t.stopIfReady;
    else if (onlyCapped) {
      // Question déjà posée une fois (mois) ou plafond atteint (mots-clés), sans refus : CV clos,
      // phrase courte ; sinon point suivant (hors dates), ou clôture du parcours.
      const next = i.corrections.find((c) => !DATE_CORRECTION.test(c));
      const lead = monthsDropped ? `${t.noMoreMonths} ` : "";
      text = i.score >= READY_SCORE ? t.closedShort : next ? `${lead}${t.nextPoint(next.replace(/\s*\(\+\d+ pts\)$/, ""))}` : t.allDone;
    } else if (hadQuestion && onlyRefused) text = t.noInsist(i.score);
    else if (hadQuestion) text = i.lang === "fr" ? TEXTS.fr.stopped(i.score, gaps) : TEXTS.en.stopped(i.score);
    else text = t.closedShort;
  } else if (i.listening.stopIfReady && i.mode === "parcours" && hadQuestion) {
    text = `${text} ${t.stopIfReady}`;
  }

  // « C'est prêt ? » : réponse directe d'abord (sauf si le texte donne déjà ce score). Ce qui bloque
  // déjà dit mot pour mot dans un message précédent : pas redit (run 2026-11-16T03-20-31, L14). Le
  // modèle ne répond pas une seconde fois : « Pas tout à fait : », « Pas encore : », « Not yet: » en
  // tête d'une de ses phrases sont retirés (run 2026-11-16T02-55-59, L15).
  if (i.listening.readiness && !text.includes(`${i.score}/100`)) {
    // Messages précédents tels qu'affichés (sans jargon, coach-plain.ts) ou tels qu'écrits.
    const saidGaps = [`Ce qui bloque surtout : ${gaps}.`, plainCoachText(`Ce qui bloque surtout : ${gaps}.`)];
    const blocking = gaps && i.previousCoach.some((m) => saidGaps.some((g) => m.includes(g))) ? "" : gaps;
    const answer = i.score >= READY_SCORE ? t.readyYes(i.score) : i.lang === "fr" ? TEXTS.fr.readyNo(i.score, blocking) : TEXTS.en.readyNo(i.score);
    const modelAnswer = (s: string) => !SERVER_STATUS.test(s) && MODEL_READINESS.test(s);
    if (splitSentences(text).some(modelAnswer)) {
      text = splitSentences(text)
        .map((s) => (modelAnswer(s) ? upper(s.replace(MODEL_READINESS, "")) : s))
        .filter((s) => s.trim())
        .join(" ");
    }
    text = `${answer} ${text}`;
  }
  return text;
}
