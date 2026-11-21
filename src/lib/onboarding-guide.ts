// Phase guidée du CV Builder (chemin A) : étapes de l'en-tête et typographie des textes
// (fonctions pures, testables).
import type { GuideStep } from "./onboarding";

/** État de l'en-tête guidé : une étape, ou « bravo » (étape 1 faite, la 2 pas encore active). */
export type GuideHeaderStep = GuideStep | "bravo";

/**
 * Étapes de l'en-tête guidé : 0 améliorer le CV (import, création, éditeur ; guide_telecharger,
 * ancienne étape, compte aussi pour elle), 1 ajouter une offre.
 */
export function guideStepIndex(step: GuideHeaderStep): number {
  return step === "guide_offre" || step === "bravo" ? 1 : 0;
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
