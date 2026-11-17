import { candidateLanguage, cvLanguage } from "./coach-language";
import { isStudentProfile, offerGap, offerLanguage, offerSteps } from "./coach-offer";
import { coachContentKey, isCvClosed, type CoachContext } from "./coach-prompt";
import { chatContent, CV_CRITERIA, cvDataToText, targetJobOf, type CvData } from "./cv-builder-types";
import { bannedPhrasesInCv, correctionsForCoach, READY_SCORE, scoreCv, type CvScore, type ScoringContext } from "./cv-score";
import { refusedOfferKeywords } from "./coach-intent";
import { keywordKey, matchCvKeywords } from "./cv-keyword-match";
import { cvTitleMismatch, type Sector } from "./cv-sector-context";
import { readCvSuggestions, type CvSuggestions } from "./cv-types";

// Contexte du coach du CV Builder, sans aucune lecture : la candidature et le contexte du score
// sont lus par l'appelant (action coachContext, avec les droits de l'utilisateur ; banc d'essai
// du coach, scripts/eval, avec des données synthétiques).

/** Mots-clés de l'offre parmi lesquels le coach choisit les 4 qu'il traite (règle dans COACH_RULES). */
const COACH_OFFER_KEYWORDS_MAX = 25;

/** Candidature liée, réduite à ce que lit le coach : les mots-clés enregistrés de son offre, et son texte (langue). */
export type CoachOfferDetail = {
  application: { cv_suggestions?: unknown; position?: string | null; offer_description?: string | null; offer_summary?: string | null };
};

/**
 * Mots-clés de l'offre encore absents du CV (recalculés à chaque échange), les plus importants
 * d'abord. Sans échec : le coach continue sans eux.
 */
export function missingOfferKeywords(detail: CoachOfferDetail | null, data: CvData, sector: Sector): string[] {
  return missingKeywordRows(detail, data, sector)
    .map((r) => r.keyword)
    .slice(0, COACH_OFFER_KEYWORDS_MAX);
}

/** Mots-clés absents, avec leur caractère spécifique (compétence technique ; tous pour l'ancien format). */
function missingKeywordRows(detail: CoachOfferDetail | null, data: CvData, sector: Sector): { keyword: string; specific: boolean }[] {
  try {
    const saved = readCvSuggestions(detail?.application.cv_suggestions);
    return saved?.kind === "keywords"
      ? matchCvKeywords(saved, cvDataToText(data), sector)
          // Refusés : le candidat a dit ne pas les avoir, le coach ne les propose plus.
          .rows.filter((r) => !r.present && !r.ignored && !r.refused)
          .map((r) => ({ keyword: r.keyword, specific: r.group === "technique" }))
      : (saved?.ce_qui_manque ?? []).map((keyword) => ({ keyword, specific: true }));
  } catch (error) {
    console.error("[cv-builder coach] mots-clés de l'offre", error);
    return [];
  }
}

/**
 * Tous les mots-clés de l'offre, présents ou absents du CV (hors ignorés) : compte des questions du
 * coach sur les mots-clés, même ceux intégrés depuis. Sans échec : liste vide.
 */
function allOfferKeywords(detail: CoachOfferDetail | null, data: CvData, sector: Sector): string[] {
  try {
    const saved = readCvSuggestions(detail?.application.cv_suggestions);
    return saved?.kind === "keywords"
      ? matchCvKeywords(saved, cvDataToText(data), sector)
          .rows.filter((r) => !r.ignored)
          .map((r) => r.keyword)
      : (saved?.ce_qui_manque ?? []);
  } catch (error) {
    console.error("[cv-builder coach] mots-clés de l'offre", error);
    return [];
  }
}

/**
 * Ce que l'écoute du serveur lit de l'offre (coach-intent.ts, listeningState) : mots-clés encore
 * absents (deux refus de suite) et tous les mots-clés (plafond de questions). undefined en mode libre.
 */
export function offerListening(built: Pick<CoachContext, "offerSteps" | "offerKeywords" | "offerKeywordsAll">) {
  return built.offerSteps ? { keywords: built.offerKeywords ?? [], allKeywords: built.offerKeywordsAll ?? [] } : undefined;
}

/** CV lié : écart principal avec l'offre et étapes nécessaires (aucune une fois le CV clos). */
function linkedSteps(data: CvData, sector: Sector, detail: CoachOfferDetail | null, closed: boolean) {
  const gap = offerGap(data, sector, missingKeywordRows(detail, data, sector).filter((r) => r.specific).length);
  return {
    offerKeywordsAll: allOfferKeywords(detail, data, sector),
    offerGap: gap,
    offerStudent: isStudentProfile(data),
    offerSteps: closed ? [] : offerSteps(data, sector, gap),
    offerLanguage: detail ? offerLanguage(detail.application) : null,
  };
}

/**
 * CV lié : mots-clés de l'offre que le candidat dit ne pas avoir dans ce message (décidé par le
 * serveur, coach-intent.ts), ajoutés à cv_suggestions.refused. Null si rien de nouveau (CV libre,
 * ancienne analyse, aucun refus ou refus déjà connu). L'appelant enregistre les suggestions.
 */
export function offerRefusals(
  detail: CoachOfferDetail | null,
  history: { role: "user" | "assistant"; content: string }[],
  request: string,
): { suggestions: CvSuggestions; added: string[] } | null {
  const saved = readCvSuggestions(detail?.application.cv_suggestions);
  if (saved?.kind !== "keywords") return null;
  const ignored = new Set(saved.ignored.map(keywordKey));
  const known = new Set(saved.refused.map(keywordKey));
  const keywords = saved.keywords.map((k) => k.keyword).filter((k) => !ignored.has(keywordKey(k)));
  const added = [...new Set(refusedOfferKeywords(history, request, keywords))].filter((k) => !known.has(keywordKey(k)));
  return added.length ? { suggestions: { ...saved, refused: [...saved.refused, ...added] }, added } : null;
}

/** Gain minimal d'une correction proposée au coach : les corrections à +1 pt ne lui sont pas données. */
export const COACH_MIN_GAIN = 2;

/**
 * Corrections du score données au coach : sans celles à +1 pt (ex. « Dates sans mois », une par
 * expérience), sauf si le CV n'est pas clos et que leur somme suffirait à atteindre le seuil
 * (score + somme des +1 ≥ 80) : le coach ne conclut pas alors à 79. L'éditeur et les textes du
 * serveur (clôture, « c'est prêt ? ») gardent toutes les corrections.
 */
export function coachCorrections(score: Pick<CvScore, "score" | "corrections">): CvScore["corrections"] {
  const small = score.corrections.filter((c) => c.points < COACH_MIN_GAIN);
  if (!small.length) return score.corrections;
  const smallSum = small.reduce((total, c) => total + c.points, 0);
  if (score.score < READY_SCORE && score.score + smallSum >= READY_SCORE) return score.corrections;
  return score.corrections.filter((c) => c.points >= COACH_MIN_GAIN);
}

export type BuiltCoachContext = CoachContext & { contentKey: string; scoring: ScoringContext };

/**
 * Contenu du CV transmis au coach, son empreinte (cache du premier message) et les données du
 * secteur (vérification des modifications). Le coach reçoit à chaque échange la liste à jour
 * des points à corriger : toutes les corrections du score, de la plus rentable à la moins
 * rentable, et les formules à éviter présentes dans le CV. `scoring` : contexte du score (secteur
 * de l'offre pour un CV lié) ; `detail` : candidature liée, null en mode libre ; `request` : dernier
 * message du candidat (langue des messages ; sans message, celle du CV).
 */
export function buildCoachContext(
  data: CvData,
  scoring: ScoringContext,
  detail: CoachOfferDetail | null,
  request: string | null = null,
  history: { role: "user" | "assistant"; content: string }[] = [],
): BuiltCoachContext {
  const cvJson = JSON.stringify(chatContent(data));
  const a = data.analysis;
  // Score calculé par le code, le même que celui affiché dans l'éditeur (secteur de l'offre pour un CV lié).
  const score = scoreCv(data, scoring);
  const offerKeywords = detail ? missingOfferKeywords(detail, data, scoring.sector) : [];
  const offer = scoring.offer ?? null;
  return {
    scoring,
    cvJson,
    offerKeywords,
    sector: scoring.sector,
    // Mots-clés des offres récentes du secteur, déjà lus pour le score : les mêmes vont au coach.
    marketKeywords: scoring.marketKeywords,
    offer,
    titleMismatch: offer ? cvTitleMismatch(data.personal.jobTitle, scoring.sector) : false,
    // CV lié : étapes d'adaptation à l'offre (titre…), aucune une fois le CV clos. Absent en mode libre.
    ...(offer ? linkedSteps(data, scoring.sector, detail, isCvClosed(score.score)) : {}),
    // Langue du candidat : son dernier message, sinon ses messages précédents, sinon le CV.
    language: candidateLanguage(request, data, history.filter((t) => t.role === "user").map((t) => t.content)),
    cvLanguage: cvLanguage(data),
    // Mots-clés, secteur et offre compris : le premier message est réécrit quand ils changent.
    contentKey: coachContentKey(cvJson, offerKeywords, scoring.sector, offer),
    score: {
      value: score.score,
      corrections: coachCorrections({ ...score, corrections: correctionsForCoach(score.corrections, scoring) }).map((c) => `${c.message} (+${c.points} pts)`),
      banned: bannedPhrasesInCv(data, scoring).map((b) => `« ${b.phrase} » dans ${b.where}`),
    },
    // CV importé : son analyse ; CV créé depuis zéro : seulement le poste visé.
    analysis: a
      ? {
          criteria: Object.fromEntries(CV_CRITERIA.map((c) => [c.label, a.criteria[c.id]])),
          improvements: a.improvements,
          optimizations: a.optimizations.map((o) => o.title),
          targetJob: targetJobOf(data),
          suggestedJobs: a.suggestedJobs,
        }
      : targetJobOf(data)
        ? { criteria: {}, improvements: [], optimizations: [], targetJob: targetJobOf(data), suggestedJobs: [] }
        : null,
  };
}
