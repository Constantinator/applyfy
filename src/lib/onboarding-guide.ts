// Phase guidée du CV Builder (chemin A) : critère « CV amélioré » et étapes de l'en-tête
// (fonctions pures, testables).
import type { CvData } from "./cv-builder-types";
import { contentFingerprint } from "./cv-translation-guard";
import type { GuideStep } from "./onboarding";

/**
 * Empreinte du contenu du CV pour la phase guidée : comme contentFingerprint (sans photo, cache de
 * Lumeo, analyse de l'import ni traduction), sans les réglages de style non plus. Le nom du CV et
 * le modèle n'en font pas partie (ils ne sont pas dans les données).
 */
export function guideContentFingerprint(data: CvData): string {
  const content: Partial<CvData> = { ...data };
  delete content.style;
  return contentFingerprint(content as CvData);
}

/**
 * CV « amélioré » : une sauvegarde a réussi et le contenu enregistré diffère de celui de
 * l'ouverture. Une sauvegarde sans vrai changement (ou nom, modèle, style seuls) ne compte pas.
 */
export function isCvImproved(baseline: string, saved: CvData): boolean {
  return guideContentFingerprint(saved) !== baseline;
}

/** Étapes de l'en-tête guidé : 0 améliorer, 1 télécharger, 2 ajouter une offre. */
export function guideStepIndex(step: GuideStep): number {
  return step === "guide_cv" ? 0 : step === "guide_telecharger" ? 1 : 2;
}
