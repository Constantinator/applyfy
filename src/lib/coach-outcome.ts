import {
  PROBLEM_BANNED_PREFIX,
  PROBLEM_INFLATED_ROLE,
  PROBLEM_INFLATED_TITLE_PREFIX,
  PROBLEM_NOT_CANDIDATE_VERB,
  PROBLEM_REMOVAL_NOT_ASKED,
  PROBLEM_STUDENT_TITLE,
  PROBLEM_TITLE_OTHER_JOB,
  PROBLEM_LOST_FIGURE,
  PROBLEM_LOST_VERB,
  PROBLEM_NEW_NUMBER_PREFIX,
  PROBLEM_NO_FIGURE,
  PROBLEM_NO_VERB,
  PROBLEM_NOT_SHORTER,
  type ChangeProblem,
  type CoachMode,
} from "./coach-proposals";
import { CV_LIMITS } from "./cv-builder-types";
import { READY_SCORE } from "./cv-score";

// Texte affiché après une réponse du coach, décidé par le code (jamais par le modèle) : cause
// exacte d'un échec, et clôture quand le CV atteint le score « prêt à postuler ». En français ou
// en anglais, selon la langue du candidat (coach-language.ts).

export type CoachLang = "fr" | "en";

const TEXTS = {
  fr: {
    missingFigure: "Peux-tu me donner un ordre de grandeur (nombre, %, durée, budget) pour que je puisse l'écrire ?",
    defaultSummary: "C'est fait : j'ai mis à jour ton CV.",
    format: "la réponse que j'avais préparée avait un format invalide.",
    stale: "ce passage a changé entre-temps. Redemande-moi la modification.",
    requestFailedEnd: "Tu peux reformuler ta demande, ou modifier ce texte directement dans l'aperçu.",
    noop: "la modification proposée ne change rien à ton CV.",
    unknown: "la modification n'a pas pu être appliquée.",
    bulletLimit: `la limite de ${CV_LIMITS.bullets} puces est atteinte pour cette expérience.`,
    verb: "j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »).",
    figure: "il me manque un chiffre ou un ordre de grandeur pour écrire cette puce.",
    banned: (phrase: string) => `le texte proposé contenait « ${phrase} », une formule trop vague pour un recruteur.`,
    lostVerb: "la nouvelle version ne disait plus ce que tu faisais, contrairement à ta puce d'origine.",
    lostFigure: "la nouvelle version perdait le chiffre de ta puce d'origine.",
    invented: (numbers: string) => `le texte proposé contenait un nombre qui ne vient ni de ton CV ni de tes messages (${numbers}).`,
    notCandidateVerb:
      "la puce gardait l'ancien verbe au lieu de celui que tu as employé. Je la laisse telle quelle pour l'instant : dis-moi si tu veux que je la reformule avec tes mots.",
    studentTitle: "le titre proposé t'orientait vers un métier que tes expériences et tes études ne montrent pas.",
    removalNotAsked: "je ne supprime un passage que si tu me le demandes : dis-le-moi si tu veux le retirer.",
    bulletsDone: (items: string) => `C'est fait : ${items}.`,
    bulletWritten: (quote: string, place: string) => `« ${quote} » — ${place}`,
    bulletRemoved: (quote: string, place: string) => `puce supprimée « ${quote} » — ${place}`,
    bulletsMore: (n: number) => `et ${n} autre${n > 1 ? "s" : ""} modification${n > 1 ? "s" : ""}`,
    titleOtherJob: "le titre proposé présentait un métier que ton CV ne montre pas.",
    inflatedRole: "ta puce d'origine disait que tu avais participé : je ne peux pas écrire que tu l'as mené seul.",
    inflatedTitle: (words: string) => `le titre proposé annonçait un niveau (${words}) que ton CV ne montre pas.`,
    wordCount: (before: number, after: number) => `Le texte passe de ${before} à ${after} mots.`,
    notShorter: "je n'ai pas réussi à le raccourcir d'au moins 20 % sans retirer une information. Dis-moi ce que je peux enlever.",
    requestFailed: "Je n'ai pas pu faire cette modification : ",
    otherFailed: "Je n'ai pas pu appliquer cette modification à ton CV. ",
    otherFailedEnd: "Peux-tu reformuler ta demande ?",
    experienceFailed: "Je n'ai pas pu modifier ton CV : ",
    announce: (places: string) => `C'est fait, j'ai modifié : ${places}.`,
    notChanged: (place: string) => `Pas modifié — ${place} : `,
    bulletsNotAdded: "Certaines puces n'ont pas été ajoutées : ",
    partNotApplied: "Une partie de la modification n'a pas été appliquée : ",
    scoreLine: (score: number) => `Ton CV est à ${score}/100.`,
    closure: (score: number) =>
      `Ton CV est prêt : il atteint ${score}/100 (seuil de ${READY_SCORE}). Tu peux encore le modifier en cliquant sur n'importe quel texte dans l'aperçu, ou me demander une modification précise. Bonne chance pour tes candidatures.`,
    hints: (hints: string) => `Pistes facultatives, sans urgence : ${hints}.`,
    offerHint: (keywords: string) => `mots-clés de l'offre à envisager : ${keywords}`,
    closedOpening: (score: number) =>
      `Ton CV est prêt : il atteint ${score}/100 (seuil de ${READY_SCORE}). Je n'ai plus de question à te poser. Si tu veux une modification précise (raccourcir, reformuler, réorganiser…), demande-la-moi.`,
    quotaRequest: (where: string) =>
      `Je n'ai pas modifié ton CV : c'est ton quota d'adaptations du mois qui bloque, il est épuisé. Reste à faire : la modification demandée sur ${where}. Tu peux la faire toi-même en cliquant sur le texte dans l'aperçu.`,
    quotaPath: (where: string) =>
      `Je n'ai pas modifié ton CV : c'est ton quota d'adaptations du mois qui bloque, il est épuisé. Reste à faire : la modification prévue sur ${where}.`,
    sections: {
      personal: "tes coordonnées ou ton titre",
      summary: "ton accroche",
      experience: "une expérience",
      education: "une formation",
      skills: "tes compétences",
      languages: "tes langues",
      certifications: "tes certifications",
      projects: "un projet",
      interests: "tes centres d'intérêt",
    } as Record<string, string>,
    anySection: "ton CV",
  },
  en: {
    missingFigure: "Can you give me an order of magnitude (number, %, duration, budget) so I can write it?",
    defaultSummary: "Done: I've updated your CV.",
    format: "the answer I had prepared had an invalid format.",
    stale: "this part changed in the meantime. Please ask me again.",
    requestFailedEnd: "You can rephrase your request, or edit this text directly in the preview.",
    noop: "the proposed change doesn't change anything in your CV.",
    unknown: "the change could not be applied.",
    bulletLimit: `this experience already has the maximum of ${CV_LIMITS.bullets} bullets.`,
    verb: "I need the bullet to start with what you actually did (for example “Led…”, “Organised…”).",
    figure: "I'm missing a number or an order of magnitude to write this bullet.",
    banned: (phrase: string) => `the proposed text contained “${phrase}”, a phrase too vague for a recruiter.`,
    lostVerb: "the new version no longer said what you did, unlike your original bullet.",
    lostFigure: "the new version lost the number from your original bullet.",
    invented: (numbers: string) => `the proposed text contained a number that comes neither from your CV nor from your messages (${numbers}).`,
    notCandidateVerb:
      "the bullet kept the old verb instead of the one you used. I'm leaving it as it is for now: tell me if you want me to rephrase it with your words.",
    studentTitle: "the proposed title pointed you towards a job your experience and studies don't show.",
    removalNotAsked: "I only remove something if you ask me to: tell me if you want it removed.",
    bulletsDone: (items: string) => `Done: ${items}.`,
    bulletWritten: (quote: string, place: string) => `“${quote}” — ${place}`,
    bulletRemoved: (quote: string, place: string) => `removed bullet “${quote}” — ${place}`,
    bulletsMore: (n: number) => `and ${n} other change${n > 1 ? "s" : ""}`,
    titleOtherJob: "the proposed title presented a job your CV doesn't show.",
    inflatedRole: "your original bullet said you took part in it: I can't write that you led it alone.",
    inflatedTitle: (words: string) => `the proposed title claimed a level (${words}) that your CV doesn't show.`,
    wordCount: (before: number, after: number) => `The text goes from ${before} to ${after} words.`,
    notShorter: "I couldn't shorten it by at least 20% without removing information. Tell me what I can cut.",
    requestFailed: "I couldn't make this change: ",
    otherFailed: "I couldn't apply this change to your CV. ",
    otherFailedEnd: "Can you rephrase your request?",
    experienceFailed: "I couldn't update your CV: ",
    announce: (places: string) => `Done, I've updated: ${places}.`,
    notChanged: (place: string) => `Not changed — ${place}: `,
    bulletsNotAdded: "Some bullets were not added: ",
    partNotApplied: "Part of the change was not applied: ",
    scoreLine: (score: number) => `Your CV is at ${score}/100.`,
    closure: (score: number) =>
      `Your CV is ready: it reaches ${score}/100 (threshold ${READY_SCORE}). You can still edit it by clicking any text in the preview, or ask me for a specific change. Good luck with your applications.`,
    hints: (hints: string) => `Optional ideas, no rush: ${hints}.`,
    offerHint: (keywords: string) => `job offer keywords to consider: ${keywords}`,
    closedOpening: (score: number) =>
      `Your CV is ready: it reaches ${score}/100 (threshold ${READY_SCORE}). I have no more questions for you. If you want a specific change (shorten, rephrase, reorganise…), just ask.`,
    quotaRequest: (where: string) =>
      `I didn't change your CV: your monthly adaptation quota is used up. Still to do: the change you asked for on ${where}. You can make it yourself by clicking the text in the preview.`,
    quotaPath: (where: string) => `I didn't change your CV: your monthly adaptation quota is used up. Still to do: the planned change on ${where}.`,
    sections: {
      personal: "your contact details or title",
      summary: "your summary",
      experience: "an experience",
      education: "an education entry",
      skills: "your skills",
      languages: "your languages",
      certifications: "your certifications",
      projects: "a project",
      interests: "your interests",
    } as Record<string, string>,
    anySection: "your CV",
  },
};

/** Question posée quand une modification attendue manque un chiffre et que le coach n'en pose pas. */
export const MISSING_FIGURE_QUESTION = TEXTS.fr.missingFigure;

export type CoachOutcomeInput = {
  /** Mode de la première réponse : « demande » (demande explicite du candidat) ou « parcours ». */
  mode: CoachMode;
  /** Section que le coach voulait modifier (null : aucune modification voulue). */
  section: string | null;
  /** Changements appliqués, et changements dont le passage a disparu entre-temps. */
  applied: number;
  stale: number;
  /** Réponse retenue (après le second essai) au contenu illisible ou invalide ; idem pour la première. */
  invalid: boolean;
  firstInvalid: boolean;
  /** La réponse proposait une modification qui ne change rien au CV. */
  noChange: boolean;
  /** Textes refusés après le second essai, et à la première réponse. */
  problems: ChangeProblem[];
  firstProblems: ChangeProblem[];
  /** Question et annonce du coach. */
  message: string;
  changeSummary: string;
  /**
   * Annonce fidèle : emplacements réellement modifiés (libellés des changements appliqués) et
   * emplacement de chaque texte refusé (par identifiant de changement). `summaryFaithful` faux :
   * le résumé du modèle cite une puce restée identique ; il n'est alors pas affiché.
   */
  appliedLabels?: string[];
  refusedLabels?: Record<string, string>;
  summaryFaithful?: boolean;
  /**
   * Puces d'expérience réellement écrites ou supprimées : l'annonce est écrite par le serveur, avec
   * le texte écrit cité (jamais le résumé du modèle).
   */
  bulletChanges?: BulletChange[];
  /** Demande de raccourcir appliquée : mots avant et après, calculés par le serveur. */
  wordCounts?: { before: number; after: number };
  /** Score avant et après l'application (null après : rien n'a été appliqué). */
  scoreBefore: number;
  scoreAfter: number | null;
  /** Corrections restantes du score (de la plus rentable) et mots-clés de l'offre encore absents. */
  corrections: string[];
  offerKeywords: string[];
  /** Langue du candidat (français par défaut). */
  lang?: CoachLang;
};

type Kind = "format" | "limit" | "shorten" | "verb" | "banned" | "regression" | "invented" | "faithful" | "stale" | "noop" | "figure" | "unknown";
type Cause = { kind: Kind; text: string };
/** Ordre d'affichage : le chiffre manquant vient en dernier. */
const RANK: Kind[] = ["format", "limit", "shorten", "verb", "banned", "regression", "invented", "faithful", "stale", "noop", "figure", "unknown"];

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** Minuscule initiale, sauf le pronom anglais « I » (« I'm », « I need »). */
const lowerFirst = (text: string) => (/^I\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1));

/** Causes d'un texte refusé. */
function problemCauses(problem: ChangeProblem, lang: CoachLang): Cause[] {
  const t = TEXTS[lang];
  if (problem.limit) {
    const message = problem.problems[0] ?? "";
    const bullets = /^experiences\.\d+\.bullets$/.test(problem.path ?? "") && message.includes("trop d'éléments");
    // Message du champ écrit en français par la validation du CV : repris tel quel en français seulement.
    const field = lang === "fr" ? lowerFirst(message) : "one field of the CV is too long or has too many items.";
    return [{ kind: "limit", text: bullets ? t.bulletLimit : field }];
  }
  return problem.problems.flatMap((p): Cause[] => {
    if (p === PROBLEM_NO_VERB) return [{ kind: "verb", text: t.verb }];
    if (p === PROBLEM_NO_FIGURE) return [{ kind: "figure", text: t.figure }];
    if (p === PROBLEM_NOT_SHORTER) return [{ kind: "shorten", text: t.notShorter }];
    if (p === PROBLEM_INFLATED_ROLE) return [{ kind: "faithful", text: t.inflatedRole }];
    if (p === PROBLEM_TITLE_OTHER_JOB) return [{ kind: "faithful", text: t.titleOtherJob }];
    if (p === PROBLEM_NOT_CANDIDATE_VERB) return [{ kind: "faithful", text: t.notCandidateVerb }];
    if (p === PROBLEM_REMOVAL_NOT_ASKED) return [{ kind: "faithful", text: t.removalNotAsked }];
    if (p === PROBLEM_STUDENT_TITLE) return [{ kind: "faithful", text: t.studentTitle }];
    if (p.startsWith(PROBLEM_INFLATED_TITLE_PREFIX)) return [{ kind: "faithful", text: t.inflatedTitle(p.slice(PROBLEM_INFLATED_TITLE_PREFIX.length)) }];
    if (p.startsWith(PROBLEM_BANNED_PREFIX)) {
      return [{ kind: "banned", text: t.banned(p.slice(PROBLEM_BANNED_PREFIX.length).replace(/\s*»\s*$/, "")) }];
    }
    if (p === PROBLEM_LOST_VERB) return [{ kind: "verb", text: t.lostVerb }];
    if (p === PROBLEM_LOST_FIGURE) return [{ kind: "regression", text: t.lostFigure }];
    if (p.startsWith(PROBLEM_NEW_NUMBER_PREFIX)) return [{ kind: "invented", text: t.invented(p.slice(PROBLEM_NEW_NUMBER_PREFIX.length)) }];
    return [];
  });
}

/** Causes sans doublon, dans l'ordre d'affichage. */
function sortedCauses(causes: Cause[]): Cause[] {
  const unique = causes.filter((c, i) => causes.findIndex((o) => o.text === c.text) === i);
  return unique.sort((a, b) => RANK.indexOf(a.kind) - RANK.indexOf(b.kind));
}

/** Phrases des causes : la première en minuscule si elle suit des deux-points, les autres en majuscule. */
const sentences = (causes: Cause[], afterColon: boolean) =>
  causes.map((c, i) => (i === 0 && afterColon ? lowerFirst(c.text) : upperFirst(c.text))).join(" ");

/** Fin des libellés de changement (coach-proposals.ts), en anglais. */
const LABEL_EN: [RegExp, string][] = [
  [/— nouvelle puce$/, "— new bullet"],
  [/— puce (\d+) supprimée$/, "— bullet $1 removed"],
  [/— puce (\d+)$/, "— bullet $1"],
  [/— puces$/, "— bullets"],
  [/— supprimé$/, "— removed"],
  [/ chez /, " at "],
  [/^Accroche$/, "Summary"],
  [/^Titre du CV$/, "CV title"],
  [/^Compétences$/, "Skills"],
  [/^Langues$/, "Languages"],
  [/^Certifications$/, "Certifications"],
  [/^Centres d'intérêt$/, "Interests"],
];

/** Libellé d'un changement lisible dans une phrase : « Stage chez X — puce 2 » → « Stage chez X (puce 2) ». */
function placeName(label: string, lang: CoachLang) {
  const localized = lang === "en" ? LABEL_EN.reduce((text, [from, to]) => text.replace(from, to), label) : label;
  return localized.replace(/\s+—\s+(.+)$/, " ($1)");
}

/** Puce écrite (ajoutée, modifiée, déplacée) ou supprimée, avec son emplacement. */
export type BulletChange = { kind: "written" | "removed"; text: string; label: string };
/** Longueur maximale d'une citation et nombre de citations dans l'annonce. */
const QUOTE_MAX = 140;
const QUOTES_MAX = 3;
const quoted = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX - 1).trimEnd()}…` : flat;
};

/**
 * Annonce des puces écrite par le serveur : le texte réellement écrit (ou supprimé) entre
 * guillemets, dans la langue du CV, 140 caractères au plus ; 3 changements au plus, puis « et N
 * autres » ; le reste dans la langue du candidat.
 */
export function bulletAnnouncement(changes: BulletChange[], lang: CoachLang): string {
  const t = TEXTS[lang];
  const items = changes.slice(0, QUOTES_MAX).map((c) => {
    const place = placeName(c.label, lang);
    return c.kind === "removed" ? t.bulletRemoved(quoted(c.text), place) : t.bulletWritten(quoted(c.text), place);
  });
  if (changes.length > QUOTES_MAX) items.push(t.bulletsMore(changes.length - QUOTES_MAX));
  return t.bulletsDone(items.join(" ; "));
}

/** Annonce écrite par le serveur à partir des emplacements réellement modifiés. */
function appliedAnnouncement(labels: string[] | undefined, lang: CoachLang) {
  const places = [...new Set(labels ?? [])];
  return places.length ? TEXTS[lang].announce(places.map((l) => placeName(l, lang)).join(" ; ")) : TEXTS[lang].defaultSummary;
}

/**
 * Clôture complète : le CV vient de passer le seuil « prêt à postuler ». Les corrections du score
 * sont écrites en français : en anglais, seules les pistes de mots-clés de l'offre sont données.
 */
export function closureMessage(score: number, corrections: string[], offerKeywords: string[], lang: CoachLang = "fr") {
  const t = TEXTS[lang];
  const hints = [
    ...(lang === "fr" ? corrections.slice(0, 3) : []),
    ...(offerKeywords.length ? [t.offerHint(offerKeywords.slice(0, 3).join(", "))] : []),
  ];
  return [t.closure(score), hints.length ? t.hints(hints.join(" ; ")) : null].filter(Boolean).join(" ");
}

/** Premier message du coach quand le CV est déjà clos : écrit par le serveur, sans appel au modèle. */
export function closedOpening(score: number, lang: CoachLang = "fr") {
  return TEXTS[lang].closedOpening(score);
}

/**
 * Modification bloquée par le quota d'adaptations du mois (et non par son contenu) : le texte le
 * dit clairement, avec ce qui reste à faire. En mode parcours, la question du coach suit ; en mode
 * demande, non (elle parlerait d'autre chose que la demande restée en attente).
 */
export function quotaBlockedText({ mode, section, message, lang = "fr" }: { mode: CoachMode; section: string; message: string; lang?: CoachLang }) {
  const t = TEXTS[lang];
  const where = t.sections[section] ?? t.anySection;
  if (mode === "demande") return t.quotaRequest(where);
  const blocked = t.quotaPath(where);
  return message.includes("?") ? `${blocked} ${message}` : blocked;
}

/** Texte de la réponse du coach affiché au candidat. */
export function coachReplyText(i: CoachOutcomeInput): string {
  if (i.section === null) return i.message;
  const lang = i.lang ?? "fr";
  const t = TEXTS[lang];
  const request = i.mode === "demande";
  const experience = i.section === "experience";
  const asked = i.message.includes("?") ? i.message : "";
  const causesOf = (p: ChangeProblem) => problemCauses(p, lang);
  const fromProblems = (i.problems.length ? i.problems : i.firstProblems).flatMap(causesOf);

  if (!i.applied) {
    const causes: Cause[] = [...fromProblems];
    if (i.invalid) causes.push({ kind: "format", text: t.format });
    if (i.stale) causes.push({ kind: "stale", text: t.stale });
    if (i.noChange) causes.push({ kind: "noop", text: t.noop });
    if (!causes.length) causes.push(i.firstInvalid ? { kind: "format", text: t.format } : { kind: "unknown", text: t.unknown });
    const sorted = sortedCauses(causes);
    if (request) return `${t.requestFailed}${sentences(sorted, true)} ${t.requestFailedEnd}`;
    if (!experience) return `${t.otherFailed}${sentences(sorted, false)} ${t.otherFailedEnd}`;
    const question = sorted.some((c) => c.kind === "figure") ? asked || t.missingFigure : asked;
    return [`${t.experienceFailed}${sentences(sorted, true)}`, question].filter(Boolean).join(" ");
  }

  // Modification appliquée, en tout ou en partie.
  const partial: Cause[] = [...fromProblems];
  if (i.stale) partial.push({ kind: "stale", text: t.stale });
  const sorted = sortedCauses(partial);
  // Ce qui n'a pas été modifié : chaque texte refusé avec son emplacement quand il est connu.
  const refused = i.problems.length ? i.problems : i.firstProblems;
  const named = refused.every((p) => i.refusedLabels?.[p.changeId]);
  const partialText = !sorted.length
    ? null
    : named && refused.length
      ? [
          ...refused.map((p) => `${t.notChanged(placeName(i.refusedLabels![p.changeId], lang))}${sentences(sortedCauses(causesOf(p)), true)}`),
          ...(i.stale ? [upperFirst(t.stale)] : []),
        ].join(" ")
      : `${experience && !request ? t.bulletsNotAdded : t.partNotApplied}${sentences(sorted, true)}`;
  // Le résumé du modèle n'est repris que si tout a été appliqué tel quel ; sinon, annonce du serveur.
  const announced = i.bulletChanges?.length
    ? bulletAnnouncement(i.bulletChanges, lang)
    : !sorted.length && i.summaryFaithful !== false && i.changeSummary
      ? i.changeSummary
      : appliedAnnouncement(i.appliedLabels, lang);
  const summary = i.wordCounts ? `${announced} ${t.wordCount(i.wordCounts.before, i.wordCounts.after)}` : announced;

  if (i.scoreAfter !== null && i.scoreAfter >= READY_SCORE) {
    // Passage du seuil : clôture complète ; déjà au-dessus avant : une ligne courte, sans nouvelle clôture.
    const end = i.scoreBefore < READY_SCORE ? closureMessage(i.scoreAfter, i.corrections, i.offerKeywords, lang) : t.scoreLine(i.scoreAfter);
    // CV déjà clos et demande explicite : la suite proposée par le coach (« Je continue avec … ? ») est gardée.
    const next = request && i.scoreBefore >= READY_SCORE ? i.message : null;
    return [summary, partialText, end, next].filter(Boolean).join(" ");
  }
  const needsFigure = sorted.some((c) => c.kind === "figure");
  const question = needsFigure ? asked || t.missingFigure : partialText ? asked : i.message;
  return [summary, partialText, question].filter(Boolean).join(" ");
}
