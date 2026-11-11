import {
  PROBLEM_BANNED_PREFIX,
  PROBLEM_LOST_FIGURE,
  PROBLEM_LOST_VERB,
  PROBLEM_NEW_NUMBER_PREFIX,
  PROBLEM_NO_FIGURE,
  PROBLEM_NO_VERB,
  type ChangeProblem,
  type CoachMode,
} from "./coach-proposals";
import { CV_LIMITS } from "./cv-builder-types";
import { READY_SCORE } from "./cv-score";

// Texte affiché après une réponse du coach, décidé par le code (jamais par le modèle) : cause
// exacte d'un échec, et clôture quand le CV atteint le score « prêt à postuler ».

/** Question posée quand une modification attendue manque un chiffre et que le coach n'en pose pas. */
export const MISSING_FIGURE_QUESTION =
  "Peux-tu me donner un ordre de grandeur (nombre, %, durée, budget) pour que je puisse l'écrire ?";

const DEFAULT_SUMMARY = "C'est fait : j'ai mis à jour ton CV.";
const FORMAT_CAUSE = "la réponse que j'avais préparée avait un format invalide.";
const STALE_CAUSE = "ce passage a changé entre-temps. Redemande-moi la modification.";

/** Fin d'un échec en mode demande : pas de question de parcours, pas de demande de chiffre. */
const REQUEST_FAILED_END = "Tu peux reformuler ta demande, ou modifier ce texte directement dans l'aperçu.";

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
  /** Score avant et après l'application (null après : rien n'a été appliqué). */
  scoreBefore: number;
  scoreAfter: number | null;
  /** Corrections restantes du score (de la plus rentable) et mots-clés de l'offre encore absents. */
  corrections: string[];
  offerKeywords: string[];
};

type Kind = "format" | "limit" | "verb" | "banned" | "regression" | "invented" | "stale" | "noop" | "figure" | "unknown";
type Cause = { kind: Kind; text: string };
/** Ordre d'affichage : le chiffre manquant vient en dernier. */
const RANK: Kind[] = ["format", "limit", "verb", "banned", "regression", "invented", "stale", "noop", "figure", "unknown"];

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Causes d'un texte refusé. */
function problemCauses(problem: ChangeProblem): Cause[] {
  if (problem.limit) {
    const message = problem.problems[0] ?? "";
    const bullets = /^experiences\.\d+\.bullets$/.test(problem.path ?? "") && message.includes("trop d'éléments");
    return [
      {
        kind: "limit",
        text: bullets ? `la limite de ${CV_LIMITS.bullets} puces est atteinte pour cette expérience.` : lowerFirst(message),
      },
    ];
  }
  return problem.problems.flatMap((p): Cause[] => {
    if (p === PROBLEM_NO_VERB) {
      return [{ kind: "verb", text: "j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »)." }];
    }
    if (p === PROBLEM_NO_FIGURE) {
      return [{ kind: "figure", text: "il me manque un chiffre ou un ordre de grandeur pour écrire cette puce." }];
    }
    if (p.startsWith(PROBLEM_BANNED_PREFIX)) {
      const phrase = p.slice(PROBLEM_BANNED_PREFIX.length).replace(/\s*»\s*$/, "");
      return [{ kind: "banned", text: `le texte proposé contenait « ${phrase} », une formule trop vague pour un recruteur.` }];
    }
    if (p === PROBLEM_LOST_VERB) {
      return [{ kind: "verb", text: "la nouvelle version ne disait plus ce que tu faisais, contrairement à ta puce d'origine." }];
    }
    if (p === PROBLEM_LOST_FIGURE) {
      return [{ kind: "regression", text: "la nouvelle version perdait le chiffre de ta puce d'origine." }];
    }
    if (p.startsWith(PROBLEM_NEW_NUMBER_PREFIX)) {
      const numbers = p.slice(PROBLEM_NEW_NUMBER_PREFIX.length);
      return [{ kind: "invented", text: `le texte proposé contenait un nombre qui ne vient ni de ton CV ni de tes messages (${numbers}).` }];
    }
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

/** Libellé d'un changement lisible dans une phrase : « Stage chez X — puce 2 » → « Stage chez X (puce 2) ». */
const placeName = (label: string) => label.replace(/\s+—\s+(.+)$/, " ($1)");

/** Annonce écrite par le serveur à partir des emplacements réellement modifiés. */
function appliedAnnouncement(labels: string[] | undefined) {
  const places = [...new Set(labels ?? [])];
  return places.length ? `C'est fait, j'ai modifié : ${places.map(placeName).join(" ; ")}.` : DEFAULT_SUMMARY;
}

/** Clôture complète : le CV vient de passer le seuil « prêt à postuler ». */
export function closureMessage(score: number, corrections: string[], offerKeywords: string[]) {
  const hints = [
    ...corrections.slice(0, 3),
    ...(offerKeywords.length ? [`mots-clés de l'offre à envisager : ${offerKeywords.slice(0, 3).join(", ")}`] : []),
  ];
  return [
    `Ton CV est prêt : il atteint ${score}/100 (seuil de ${READY_SCORE}). Tu peux encore le modifier en cliquant sur n'importe quel texte dans l'aperçu, ou me demander une modification précise. Bonne chance pour tes candidatures.`,
    hints.length ? `Pistes facultatives, sans urgence : ${hints.join(" ; ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Premier message du coach quand le CV est déjà clos : écrit par le serveur, sans appel au modèle. */
export function closedOpening(score: number) {
  return `Ton CV est prêt : il atteint ${score}/100 (seuil de ${READY_SCORE}). Je n'ai plus de question à te poser. Si tu veux une modification précise (raccourcir, reformuler, réorganiser…), demande-la-moi.`;
}

/** Sections telles que nommées au candidat. */
const SECTION_NAMES: Record<string, string> = {
  personal: "tes coordonnées ou ton titre",
  summary: "ton accroche",
  experience: "une expérience",
  education: "une formation",
  skills: "tes compétences",
  languages: "tes langues",
  certifications: "tes certifications",
  projects: "un projet",
  interests: "tes centres d'intérêt",
};

/**
 * Modification bloquée par le quota d'adaptations du mois (et non par son contenu) : le texte le
 * dit clairement, avec ce qui reste à faire. En mode parcours, la question du coach suit ; en mode
 * demande, non (elle parlerait d'autre chose que la demande restée en attente).
 */
export function quotaBlockedText({ mode, section, message }: { mode: CoachMode; section: string; message: string }) {
  const where = SECTION_NAMES[section] ?? "ton CV";
  if (mode === "demande") {
    return `Je n'ai pas modifié ton CV : c'est ton quota d'adaptations du mois qui bloque, il est épuisé. Reste à faire : la modification demandée sur ${where}. Tu peux la faire toi-même en cliquant sur le texte dans l'aperçu.`;
  }
  const blocked = `Je n'ai pas modifié ton CV : c'est ton quota d'adaptations du mois qui bloque, il est épuisé. Reste à faire : la modification prévue sur ${where}.`;
  return message.includes("?") ? `${blocked} ${message}` : blocked;
}

/** Texte de la réponse du coach affiché au candidat. */
export function coachReplyText(i: CoachOutcomeInput): string {
  if (i.section === null) return i.message;
  const request = i.mode === "demande";
  const experience = i.section === "experience";
  const asked = i.message.includes("?") ? i.message : "";
  const fromProblems = (i.problems.length ? i.problems : i.firstProblems).flatMap(problemCauses);

  if (!i.applied) {
    const causes: Cause[] = [...fromProblems];
    if (i.invalid) causes.push({ kind: "format", text: FORMAT_CAUSE });
    if (i.stale) causes.push({ kind: "stale", text: STALE_CAUSE });
    if (i.noChange) causes.push({ kind: "noop", text: "la modification proposée ne change rien à ton CV." });
    if (!causes.length) {
      causes.push(
        i.firstInvalid
          ? { kind: "format", text: FORMAT_CAUSE }
          : { kind: "unknown", text: "la modification n'a pas pu être appliquée." },
      );
    }
    const sorted = sortedCauses(causes);
    if (request) return `Je n'ai pas pu faire cette modification : ${sentences(sorted, true)} ${REQUEST_FAILED_END}`;
    if (!experience) {
      return `Je n'ai pas pu appliquer cette modification à ton CV. ${sentences(sorted, false)} Peux-tu reformuler ta demande ?`;
    }
    const question = sorted.some((c) => c.kind === "figure") ? asked || MISSING_FIGURE_QUESTION : asked;
    return [`Je n'ai pas pu modifier ton CV : ${sentences(sorted, true)}`, question].filter(Boolean).join(" ");
  }

  // Modification appliquée, en tout ou en partie.
  const partial: Cause[] = [...fromProblems];
  if (i.stale) partial.push({ kind: "stale", text: STALE_CAUSE });
  const sorted = sortedCauses(partial);
  // Ce qui n'a pas été modifié : chaque texte refusé avec son emplacement quand il est connu.
  const refused = i.problems.length ? i.problems : i.firstProblems;
  const named = refused.every((p) => i.refusedLabels?.[p.changeId]);
  const partialText = !sorted.length
    ? null
    : named && refused.length
      ? [
          ...refused.map((p) => `Pas modifié — ${placeName(i.refusedLabels![p.changeId])} : ${sentences(sortedCauses(problemCauses(p)), true)}`),
          ...(i.stale ? [upperFirst(STALE_CAUSE)] : []),
        ].join(" ")
      : `${experience && !request ? "Certaines puces n'ont pas été ajoutées" : "Une partie de la modification n'a pas été appliquée"} : ${sentences(sorted, true)}`;
  // Le résumé du modèle n'est repris que si tout a été appliqué tel quel ; sinon, annonce du serveur.
  const summary = !sorted.length && i.summaryFaithful !== false && i.changeSummary ? i.changeSummary : appliedAnnouncement(i.appliedLabels);

  if (i.scoreAfter !== null && i.scoreAfter >= READY_SCORE) {
    // Passage du seuil : clôture complète ; déjà au-dessus avant : une ligne courte, sans nouvelle clôture.
    const end =
      i.scoreBefore < READY_SCORE ? closureMessage(i.scoreAfter, i.corrections, i.offerKeywords) : `Ton CV est à ${i.scoreAfter}/100.`;
    // CV déjà clos et demande explicite : la suite proposée par le coach (« Je continue avec … ? ») est gardée.
    const next = request && i.scoreBefore >= READY_SCORE ? i.message : null;
    return [summary, partialText, end, next].filter(Boolean).join(" ");
  }
  const needsFigure = sorted.some((c) => c.kind === "figure");
  const question = needsFigure ? asked || MISSING_FIGURE_QUESTION : partialText ? asked : i.message;
  return [summary, partialText, question].filter(Boolean).join(" ");
}
