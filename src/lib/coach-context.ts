import { candidateLanguage, cvLanguage } from "./coach-language";
import { offerSteps } from "./coach-offer";
import { coachContentKey, isCvClosed, type CoachContext } from "./coach-prompt";
import { chatContent, CV_CRITERIA, cvDataToText, targetJobOf, type CvData } from "./cv-builder-types";
import { bannedPhrasesInCv, scoreCv, type ScoringContext } from "./cv-score";
import { matchCvKeywords } from "./cv-keyword-match";
import { cvTitleMismatch, type Sector } from "./cv-sector-context";
import { readCvSuggestions } from "./cv-types";

// Contexte du coach du CV Builder, sans aucune lecture : la candidature et le contexte du score
// sont lus par l'appelant (action coachContext, avec les droits de l'utilisateur ; banc d'essai
// du coach, scripts/eval, avec des données synthétiques).

/** Mots-clés de l'offre parmi lesquels le coach choisit les 4 qu'il traite (règle dans COACH_RULES). */
const COACH_OFFER_KEYWORDS_MAX = 25;

/** Candidature liée, réduite à ce que lit le coach : les mots-clés enregistrés de son offre. */
export type CoachOfferDetail = { application: { cv_suggestions?: unknown } };

/**
 * Mots-clés de l'offre encore absents du CV (recalculés à chaque échange), les plus importants
 * d'abord. Sans échec : le coach continue sans eux.
 */
export function missingOfferKeywords(detail: CoachOfferDetail | null, data: CvData, sector: Sector): string[] {
  try {
    const saved = readCvSuggestions(detail?.application.cv_suggestions);
    const missing =
      saved?.kind === "keywords"
        ? matchCvKeywords(saved, cvDataToText(data), sector)
            .rows.filter((r) => !r.present && !r.ignored)
            .map((r) => r.keyword)
        : (saved?.ce_qui_manque ?? []);
    return missing.slice(0, COACH_OFFER_KEYWORDS_MAX);
  } catch (error) {
    console.error("[cv-builder coach] mots-clés de l'offre", error);
    return [];
  }
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
export function buildCoachContext(data: CvData, scoring: ScoringContext, detail: CoachOfferDetail | null, request: string | null = null): BuiltCoachContext {
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
    ...(offer ? { offerSteps: isCvClosed(score.score) ? [] : offerSteps(data, scoring.sector) } : {}),
    language: candidateLanguage(request, data),
    cvLanguage: cvLanguage(data),
    // Mots-clés, secteur et offre compris : le premier message est réécrit quand ils changent.
    contentKey: coachContentKey(cvJson, offerKeywords, scoring.sector, offer),
    score: {
      value: score.score,
      corrections: score.corrections.map((c) => `${c.message} (+${c.points} pts)`),
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
