import "server-only";

import { getApplicationDetail, type ApplicationDetailResult } from "./applications";
import { chatContent, targetJobOf, type CvData } from "./cv-builder-types";
import type { ScoringContext } from "./cv-score";
import { cvScoringSector, getSectorContext, scoringOfferFor, type ScoringOffer } from "./cv-sector-context";
import { getKeywordsForSector } from "./job-scraper";

/**
 * Contexte du score d'un CV du CV Builder, pour toutes les voies qui le notent (éditeur, coach,
 * import, tableau de bord, Lumeo) : secteur de l'offre pour un CV lié à une candidature (relue
 * avec les droits de l'utilisateur, ou `detail` déjà lu), sinon secteur du CV. Un `detail` qui
 * n'est pas la candidature du CV est ignoré (repli en mode libre, scoringOfferFor).
 */
export async function loadBuilderCvScoring(
  data: CvData,
  applicationId: string | null,
  detail?: ApplicationDetailResult | null,
): Promise<ScoringContext> {
  const offerDetail = detail !== undefined ? detail : applicationId ? await getApplicationDetail(applicationId) : null;
  return loadScoringContext(data, scoringOfferFor(applicationId, offerDetail));
}

/**
 * Données du secteur pour le score du CV (cv-score.ts), avec ses mots-clés, verbes d'action et
 * expressions à éviter, et les mots-clés des offres récentes. Secteur : celui de l'offre pour un
 * CV lié à une candidature (`offer`), sinon détecté d'après le titre du CV, le poste visé et les
 * expériences (mode libre). Léger : transmis tel quel à l'éditeur.
 */
export async function loadScoringContext(data: CvData, offer?: ScoringOffer | null): Promise<ScoringContext> {
  const sector = cvScoringSector(JSON.stringify(chatContent(data)), targetJobOf(data), offer);
  const context = getSectorContext(sector);
  return {
    sector,
    sectorName: context.name,
    atsKeywords: context.ats_keywords,
    actionVerbs: context.strong_action_verbs,
    avoid: context.avoid,
    marketKeywords: await getKeywordsForSector(sector),
    offer: offer ? { position: offer.position.trim().slice(0, 120), company: offer.company.trim().slice(0, 120) } : null,
  };
}
