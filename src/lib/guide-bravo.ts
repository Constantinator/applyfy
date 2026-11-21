import "server-only";

import { getLatestBuilderCv } from "./cv-builder";
import { scoreCv } from "./cv-score";
import { loadBuilderCvScoring } from "./cv-score-context";
import { bravoTone, type BravoTone } from "./guide-bravo-tone";

/**
 * Ton de l'écran « Bravo » : score du dernier CV (celui de la phase guidée, tout juste enregistré),
 * recalculé comme dans l'éditeur et le tableau de bord. Rien dans l'adresse, rien en base.
 * Sans échec : score indisponible → ton « bon début ».
 */
export async function loadBravoTone(): Promise<BravoTone> {
  try {
    const cv = await getLatestBuilderCv();
    if (!cv) return bravoTone(null);
    const context = await loadBuilderCvScoring(cv.data, cv.applicationId);
    return bravoTone(scoreCv(cv.data, context).score);
  } catch (error) {
    console.error("[onboarding] score du CV pour « Bravo »", error);
    return bravoTone(null);
  }
}
