"use server";

import { unstable_rethrow } from "next/navigation";

import { completeOnboarding } from "@/lib/account";
import { parseOnboardingState } from "@/lib/onboarding";
import {
  advanceGuideToDownload,
  finishGuidedPhase,
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

/**
 * Fin de la phase guidée : « Passer » (étape en cours notée comme passée) ou CV téléchargé
 * (`skippedStep` null). Sans échec : la personne part de toute façon.
 */
export async function finishGuideAction(skippedStep: unknown): Promise<{ ok: boolean }> {
  const step = skippedStep === "guide_cv" || skippedStep === "guide_telecharger" ? skippedStep : null;
  try {
    await finishGuidedPhase(step);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding] fin de la phase guidée", error);
    return { ok: false };
  }
}
