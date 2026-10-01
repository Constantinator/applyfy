"use server";

import { unstable_rethrow } from "next/navigation";

import { completeOnboarding } from "@/lib/account";

/** Marque l'écran de bienvenue comme vu (il ne réapparaîtra plus, sur aucun appareil). */
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
