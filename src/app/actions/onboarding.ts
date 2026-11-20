"use server";

import { unstable_rethrow } from "next/navigation";

import { completeOnboarding } from "@/lib/account";
import { parseOnboardingState } from "@/lib/onboarding";
import {
  advanceGuideToDownload,
  advanceGuideToOffer,
  finishGuidedPhase,
  markGuideBannerSeen,
  finishOnboarding,
  saveOnboardingState,
  startGuidedPhase,
} from "@/lib/onboarding-server";

/** Marque le parcours d'accueil comme terminé dans le compte (il ne réapparaîtra plus, sur aucun appareil). */
export async function completeOnboardingAction(): Promise<{ ok: boolean }> {
  try {
    await completeOnboarding();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[completeOnboarding]", error);
    return { ok: false };
  }
}

/** Progression du parcours (écran atteint, réponses, écrans passés). Sans échec : le parcours continue. */
export async function saveOnboardingAction(input: unknown): Promise<{ ok: boolean }> {
  const state = parseOnboardingState(input);
  if (!state) return { ok: false };
  try {
    await saveOnboardingState(state);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] enregistrement", error);
    return { ok: false };
  }
}

/** Fin du parcours : la personne part ensuite vers la page choisie (navigateur). */
export async function finishOnboardingAction(input: unknown): Promise<{ ok: boolean }> {
  const state = parseOnboardingState(input);
  if (!state) return { ok: false };
  try {
    await finishOnboarding(state);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] fin", error);
    return { ok: false };
  }
}

/**
 * Chemin A (« Importer mon CV », « Le créer de zéro ») : la phase guidée commence ; sans la
 * migration 0047, le parcours est terminé comme avant. La personne part ensuite vers la page choisie.
 */
export async function startCvPathAction(input: unknown): Promise<{ ok: boolean }> {
  const state = parseOnboardingState(input);
  if (!state || (state.choice !== "import" && state.choice !== "zero")) return { ok: false };
  try {
    await startGuidedPhase(state);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] chemin A", error);
    return { ok: false };
  }
}

/** Phase guidée : CV amélioré (`skipped` false) ou « Mon CV est déjà bon, continuer » (true). */
export async function guideReadyToDownloadAction(skipped: boolean): Promise<{ ok: boolean }> {
  try {
    await advanceGuideToDownload(skipped === true);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] phase guidée, étape suivante", error);
    return { ok: false };
  }
}

/** CV téléchargé pendant la phase guidée : étape suivante, l'écran de l'offre. */
export async function guideDownloadedAction(): Promise<{ ok: boolean }> {
  try {
    await advanceGuideToOffer();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] phase guidée, téléchargement", error);
    return { ok: false };
  }
}

/** Bandeau de Lumeo sur la fiche : affiché dans le navigateur, noté comme vu. */
export async function guideBannerSeenAction(applicationId: unknown): Promise<{ ok: boolean }> {
  if (typeof applicationId !== "string" || !applicationId) return { ok: false };
  try {
    await markGuideBannerSeen(applicationId);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] bandeau de la fiche", error);
    return { ok: false };
  }
}

/**
 * Fin de la phase guidée : « Passer » ou « Plus tard » (`skippedStep` : étape en cours, notée comme
 * passée), ou « Trouver une offre » (`choice` « recherche »). Sans échec : la personne part de
 * toute façon.
 */
export async function finishGuideAction(skippedStep: unknown, choice: unknown = null): Promise<{ ok: boolean }> {
  const step =
    skippedStep === "guide_cv" || skippedStep === "guide_telecharger" || skippedStep === "guide_offre" ? skippedStep : null;
  try {
    await finishGuidedPhase(step, choice === "recherche" ? "recherche" : null);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] fin de la phase guidée", error);
    return { ok: false };
  }
}
