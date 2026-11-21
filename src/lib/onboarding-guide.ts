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

/** État de l'en-tête guidé : une étape, ou « bravo » (étapes 1 et 2 faites, la 3 pas encore active). */
export type GuideHeaderStep = GuideStep | "bravo";

/** Étapes de l'en-tête guidé : 0 améliorer, 1 enregistrer, 2 ajouter une offre. */
export function guideStepIndex(step: GuideHeaderStep): number {
  return step === "guide_cv" ? 0 : step === "guide_telecharger" ? 1 : 2;
}

/** Étape en cours (aria-current) : aucune sur l'écran « Bravo ». */
export function guideActiveIndex(step: GuideHeaderStep): number | null {
  return step === "bravo" ? null : guideStepIndex(step);
}

/**
 * Typographie française à l'écran : espace insécable devant « : ; ! ? » et à l'intérieur des
 * guillemets, trait d'union insécable avant un pronom (« Enregistre-le »), pour qu'aucun signe ni
 * morceau de mot ne se retrouve seul en début de ligne.
 */
export function frenchSpaces(text: string): string {
  return text
    .replace(/ (?=[:;!?»])/g, "\u00A0")
    .replace(/« /g, "«\u00A0")
    // « Enregistre-le », « Télécharge-le » : trait d'union insécable (pas de « Enregistre- / le »).
    .replace(/(\p{L})-(le|la|les|moi|toi|lui|leur|en|y)\b/gu, "$1\u2011$2");
}
