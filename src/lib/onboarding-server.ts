import "server-only";

import { cookies } from "next/headers";

import { completeOnboarding, needsOnboarding } from "./account";
import { listAllUsers } from "./admin-metrics";
import { requireUser } from "./auth";
import {
  isAfterLaunch,
  onboardingStats,
  resumeScreen,
  type OnboardingRow,
  type OnboardingScreen,
  type OnboardingState,
  type OnboardingStats,
} from "./onboarding";
import { isMissingTable } from "./optional-columns";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Parcours d'accueil : lecture et enregistrement de la progression (table onboarding_progress,
// migration 0045). Sans échec : si la table manque ou ne se lit pas, pas de parcours, et le
// tableau de bord reste inchangé.

/**
 * Parcours terminé dans ce navigateur (valeur : identifiant du compte). Posé avant tout
 * enregistrement : si l'écriture en base échoue, le tableau de bord ne renvoie pas vers
 * /bienvenue (pas de boucle).
 */
const DONE_COOKIE = "applyfy_parcours_fini";

export type OnboardingEntry = { screen: OnboardingScreen; state: OnboardingState };

/** Parcours à proposer maintenant (avec l'écran où reprendre), ou null. */
export async function getOnboardingEntry(): Promise<OnboardingEntry | null> {
  try {
    if (!(await needsOnboarding())) return null;
    const user = await requireUser();
    if ((await cookies()).get(DONE_COOKIE)?.value === user.id) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("step, job_search, has_cv, skipped_steps, completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) console.error("[onboarding] table absente (migration 0045) : pas de parcours");
      else console.error("[onboarding] lecture", error.message);
      return null;
    }
    if (data?.completed_at) return null;
    const screen = resumeScreen(data?.step);
    return {
      screen,
      state: {
        step: screen,
        jobSearch: data?.job_search ?? null,
        hasCv: data?.has_cv ?? null,
        skipped: data?.skipped_steps ?? [],
      },
    };
  } catch (error) {
    console.error("[onboarding] état", error);
    return null;
  }
}

/** Enregistre la progression (une ligne par compte, remplacée à chaque écran). */
export async function saveOnboardingState(state: OnboardingState, completed = false) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_progress").upsert(
    {
      user_id: user.id,
      step: state.step,
      job_search: state.jobSearch,
      has_cv: state.hasCv,
      skipped_steps: state.skipped,
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Enregistrement du parcours impossible : ${error.message}`);
}

/**
 * Fin du parcours : marque posée dans le navigateur d'abord (jamais de boucle), puis dans la
 * base et dans le compte. Chaque écriture est tentée même si l'autre échoue.
 */
export async function finishOnboarding(state: OnboardingState) {
  const user = await requireUser();
  (await cookies()).set(DONE_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  const results = await Promise.allSettled([saveOnboardingState(state, true), completeOnboarding()]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[onboarding] fin du parcours", result.reason);
  }
}

/** Statistiques du parcours pour /admin ; « absente » si la migration 0045 n'est pas appliquée. */
export async function getOnboardingAdminStats(): Promise<
  { status: "ok"; stats: OnboardingStats } | { status: "absente" } | { status: "erreur" }
> {
  try {
    const supabase = createAdminClient();
    const [{ data, error }, users] = await Promise.all([
      supabase.from("onboarding_progress").select("step, job_search, has_cv, skipped_steps, completed_at"),
      listAllUsers(supabase),
    ]);
    if (error) {
      if (isMissingTable(error)) return { status: "absente" };
      console.error("[onboarding] statistiques", error.message);
      return { status: "erreur" };
    }
    const signups = users.filter((u) => isAfterLaunch(u.createdAt)).length;
    return { status: "ok", stats: onboardingStats((data ?? []) as OnboardingRow[], signups) };
  } catch (error) {
    console.error("[onboarding] statistiques", error);
    return { status: "erreur" };
  }
}
