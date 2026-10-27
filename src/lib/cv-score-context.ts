import "server-only";

import { chatContent, type CvData } from "./cv-builder-types";
import type { ScoringContext } from "./cv-score";
import { detectSector, getSectorContext } from "./cv-sector-context";
import { getKeywordsForSector } from "./job-scraper";

/**
 * Données du secteur pour le score du CV (cv-score.ts) : secteur détecté d'après le titre du
 * CV, le poste visé et les expériences, avec ses mots-clés, verbes d'action et expressions à
 * éviter, et les mots-clés des offres récentes. Léger : transmis tel quel à l'éditeur.
 */
export async function loadScoringContext(data: CvData): Promise<ScoringContext> {
  const sector = detectSector(JSON.stringify(chatContent(data)), data.analysis?.targetJob);
  const context = getSectorContext(sector);
  return {
    sector,
    sectorName: context.name,
    atsKeywords: context.ats_keywords,
    actionVerbs: context.strong_action_verbs,
    avoid: context.avoid,
    marketKeywords: await getKeywordsForSector(sector),
  };
}
