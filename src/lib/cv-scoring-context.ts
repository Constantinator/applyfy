import { chatContent, targetJobOf, type CvData } from "./cv-builder-types";
import type { ScoringContext } from "./cv-score";
import { COMMON_ACTION_VERBS, cvScoringSector, getSectorContext, type ScoringOffer } from "./cv-sector-context";

/**
 * Contexte du score d'un CV, sans aucune lecture : secteur (celui de l'offre pour un CV lié à une
 * candidature, sinon détecté d'après le titre du CV, le poste visé et les expériences), ses
 * mots-clés, verbes d'action et expressions à éviter, et les mots-clés des offres récentes du
 * secteur (`marketKeywords`, lus par l'appelant). Utilisé par loadScoringContext (cv-score-context)
 * et par le banc d'essai du coach (scripts/eval), avec des mots-clés figés.
 */
export function scoringContextFrom(data: CvData, offer: ScoringOffer | null | undefined, marketKeywords: string[]): ScoringContext {
  const sector = cvScoringSector(JSON.stringify(chatContent(data)), targetJobOf(data), offer);
  return scoringContextForSector(sector, offer, marketKeywords);
}

/** Le même contexte, une fois le secteur connu (cvScoringSector). */
export function scoringContextForSector(
  sector: ScoringContext["sector"],
  offer: ScoringOffer | null | undefined,
  marketKeywords: string[],
): ScoringContext {
  const context = getSectorContext(sector);
  return {
    sector,
    sectorName: context.name,
    atsKeywords: context.ats_keywords,
    // Liste commune à tous les secteurs (une action reste une action quel que soit le poste visé).
    actionVerbs: COMMON_ACTION_VERBS,
    avoid: context.avoid,
    marketKeywords,
    offer: offer ? { position: offer.position.trim().slice(0, 120), company: offer.company.trim().slice(0, 120) } : null,
  };
}
