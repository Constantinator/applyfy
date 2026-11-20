"use server";

import { unstable_rethrow } from "next/navigation";

import { completeOnboarding } from "@/lib/account";
import { parseOnboardingState } from "@/lib/onboarding";
import { finishOnboarding, saveOnboardingState } from "@/lib/onboarding-server";

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
