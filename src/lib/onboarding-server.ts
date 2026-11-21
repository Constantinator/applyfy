import "server-only";

import { cookies } from "next/headers";

import { completeOnboarding, getOnboardingAccount, needsOnboarding } from "./account";
import { listAllUsers } from "./admin-metrics";
import { requireUser } from "./auth";
import {
  guidedEditorStep,
  guidedPhaseStep,
  isAfterLaunch,
  onboardingStats,
  resumeTarget,
  withSkipped,
  type GuideEditorStep,
  type GuideStep,
  type OnboardingChoice,
  type OnboardingRow,
  type OnboardingScreen,
  type OnboardingState,
  type OnboardingStats,
  type ResumeTarget,
} from "./onboarding";
import { isMissingTable } from "./optional-columns";
import { createAdminClient } from "./supabase/admin";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Parcours d'accueil : lecture et enregistrement de la progression (table onboarding_progress,
// migration 0045). Sans échec : si la table manque ou ne se lit pas, pas de parcours, et le
// tableau de bord reste inchangé.

/**
 * Parcours terminé dans ce navigateur (valeur : identifiant du compte). Posé avant tout
 * enregistrement : si l'écriture en base échoue, le tableau de bord ne renvoie pas vers
 * /bienvenue (pas de boucle).
 */
const DONE_COOKIE = "applyfy_parcours_fini";

/**
 * Parcours à reprendre : où (écran de /bienvenue, ou éditeur du CV pendant la phase guidée) et
 * l'état enregistré. `screen` : écran de /bienvenue à afficher si la cible est /bienvenue.
 */
export type OnboardingEntry = { target: ResumeTarget; screen: OnboardingScreen; state: OnboardingState };

type ProgressRow = {
  step: OnboardingState["step"];
  job_search: OnboardingState["jobSearch"];
  has_cv: OnboardingState["hasCv"];
  choice: OnboardingState["choice"];
  skipped_steps: OnboardingState["skipped"];
  completed_at: string | null;
};

/** Ligne du compte connecté ; « illisible » si la lecture échoue (table absente…). */
async function readOwnRow(userId: string): Promise<ProgressRow | null | "illisible"> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("step, job_search, has_cv, choice, skipped_steps, completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) console.error("[onboarding] table absente (migration 0045) : pas de parcours");
    else console.error("[onboarding] lecture", error.message);
    return "illisible";
  }
  return (data as ProgressRow | null) ?? null;
}

const stateOf = (row: ProgressRow | null): OnboardingState => ({
  step: row?.step ?? "accueil",
  jobSearch: row?.job_search ?? null,
  hasCv: row?.has_cv ?? null,
  choice: row?.choice ?? null,
  skipped: row?.skipped_steps ?? [],
});

/** Identifiant du dernier CV modifié du compte, ou null (aucun, ou lecture impossible). */
async function latestCvId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_builder")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("[onboarding] dernier CV", error.message);
  return (data?.id as string | undefined) ?? null;
}

const isGuidedEditorStep = (step: string | undefined) => step === "guide_cv" || step === "guide_telecharger";

/** Parcours à proposer maintenant (avec l'endroit où reprendre), ou null. */
export async function getOnboardingEntry(): Promise<OnboardingEntry | null> {
  try {
    if (!(await needsOnboarding())) return null;
    const user = await requireUser();
    if ((await cookies()).get(DONE_COOKIE)?.value === user.id) return null;

    const row = await readOwnRow(user.id);
    if (row === "illisible" || row?.completed_at) return null;
    // Phase guidée : l'éditeur du dernier CV (s'il existe ; sinon le choix « importer ou créer »).
    const cvId = isGuidedEditorStep(row?.step) ? await latestCvId(user.id) : null;
    const target = resumeTarget(row?.step, cvId);
    const screen = target.kind === "bienvenue" ? target.screen : "chemin_cv";
    return { target, screen, state: { ...stateOf(row), step: screen } };
  } catch (error) {
    console.error("[onboarding] état", error);
    return null;
  }
}

/**
 * Éditeur de ce CV en mode guidé ? L'étape (améliorer ou télécharger), ou null : jamais pour un
 * ancien compte, un parcours terminé ou passé, ou un autre CV que le dernier. Sans échec.
 */
export async function getGuidedEditorStep(cvId: string): Promise<GuideEditorStep | null> {
  try {
    const account = await getOnboardingAccount();
    // Ancien compte ou parcours terminé : aucune lecture de plus.
    if (!isAfterLaunch(account.createdAt) || account.completed) return null;
    const user = await requireUser();
    const doneCookie = (await cookies()).get(DONE_COOKIE)?.value === user.id;
    if (doneCookie) return null;
    const row = await readOwnRow(user.id);
    if (row === "illisible" || !row || !isGuidedEditorStep(row.step)) return null;
    return guidedEditorStep({
      createdAt: account.createdAt,
      metadataCompleted: account.completed,
      doneCookie,
      progress: { step: row.step, completed: Boolean(row.completed_at) },
      cvId,
      latestCvId: await latestCvId(user.id),
    });
  } catch (error) {
    console.error("[onboarding] éditeur guidé", error);
    return null;
  }
}

/**
 * Phase guidée en cours (pages d'import et de création : verrou de la navigation) : l'étape 1 ou
 * 2, ou null. Jamais pour un ancien compte, un parcours terminé ou passé. Sans échec.
 */
export async function getGuidedPhaseStep(): Promise<GuideEditorStep | null> {
  try {
    const account = await getOnboardingAccount();
    if (!isAfterLaunch(account.createdAt) || account.completed) return null;
    const user = await requireUser();
    const doneCookie = (await cookies()).get(DONE_COOKIE)?.value === user.id;
    if (doneCookie) return null;
    const row = await readOwnRow(user.id);
    if (row === "illisible" || !row) return null;
    return guidedPhaseStep({
      createdAt: account.createdAt,
      metadataCompleted: account.completed,
      doneCookie,
      progress: { step: row.step, completed: Boolean(row.completed_at) },
    });
  } catch (error) {
    console.error("[onboarding] phase guidée", error);
    return null;
  }
}

/**
 * Chemin A : la phase guidée commence (étape « guide_cv »). Si la base la refuse (migration 0047
 * pas encore appliquée) ou en cas d'erreur, le parcours est terminé comme avant. true : guidée.
 */
export async function startGuidedPhase(state: OnboardingState): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_progress").upsert(
    {
      user_id: user.id,
      step: "guide_cv",
      job_search: state.jobSearch,
      has_cv: state.hasCv,
      choice: state.choice,
      skipped_steps: state.skipped,
    },
    { onConflict: "user_id" },
  );
  if (!error) return true;
  if (error.code === "23514") console.error("[onboarding] phase guidée refusée par la base (migration 0047 absente) : parcours terminé");
  else console.error("[onboarding] phase guidée", error.message);
  await finishOnboarding(state);
  return false;
}

/**
 * Phase guidée, étape 1 terminée (CV amélioré, ou « Mon CV est déjà bon ») : étape
 * « guide_telecharger ». Sans effet hors de l'étape « guide_cv ».
 */
export async function advanceGuideToDownload(skipped: boolean) {
  const user = await requireUser();
  const row = await readOwnRow(user.id);
  if (row === "illisible" || !row || row.completed_at || row.step !== "guide_cv") return;
  const state = stateOf(row);
  await saveOnboardingState({ ...(skipped ? withSkipped(state, "guide_cv") : state), step: "guide_telecharger" });
}

/**
 * CV enregistré pendant la phase guidée (« Enregistrer mon CV ») : étape « guide_offre » (écran
 * « Bravo », puis l'écran de l'offre ; la reprise mène à l'écran de l'offre). Sans effet hors des
 * étapes de l'éditeur.
 */
export async function advanceGuideToOffer() {
  const user = await requireUser();
  const row = await readOwnRow(user.id);
  if (row === "illisible" || !row || row.completed_at || !isGuidedEditorStep(row.step)) return;
  await saveOnboardingState({ ...stateOf(row), step: "guide_offre" });
}

/**
 * Fin de la phase guidée : « Passer » ou « Plus tard » (étape notée comme passée), ou « Trouver
 * une offre » (choix noté). Le parcours est terminé (marque du navigateur posée d'abord, jamais
 * de boucle).
 */
export async function finishGuidedPhase(skippedStep: GuideStep | null, choice: OnboardingChoice | null = null) {
  const user = await requireUser();
  const row = await readOwnRow(user.id).catch(() => "illisible" as const);
  const base: OnboardingState =
    row === "illisible" || !row ? { step: "guide_cv", jobSearch: null, hasCv: "oui", choice: null, skipped: [] } : stateOf(row);
  const state = choice ? { ...base, choice } : base;
  await finishOnboarding(skippedStep ? withSkipped(state, skippedStep) : state);
}

/**
 * Candidature créée depuis l'écran de l'offre (accueil=1) : seulement si l'étape en base est
 * « guide_offre », la candidature est notée (bandeau de sa fiche) et le parcours terminé. Sans
 * effet sinon. Sans échec : une erreur est journalisée, la candidature est créée quoi qu'il arrive.
 */
export async function completeGuideWithApplication(applicationId: string) {
  try {
    const user = await requireUser();
    const row = await readOwnRow(user.id);
    if (row === "illisible" || !row || row.completed_at || row.step !== "guide_offre") return;
    const supabase = await createClient();
    const { error } = await supabase
      .from("onboarding_progress")
      .update({ guide_application_id: applicationId })
      .eq("user_id", user.id);
    if (error) console.error("[onboarding] candidature de la phase guidée", error.message);
    await finishOnboarding({ ...stateOf(row), choice: "lien" });
  } catch (error) {
    console.error("[onboarding] candidature de la phase guidée", error);
  }
}

/**
 * Bandeau de Lumeo sur la fiche : seulement pour la candidature créée depuis la phase guidée, tant
 * qu'il n'a pas été vu. Sans échec : false si la lecture échoue (colonnes absentes…).
 */
export async function shouldShowGuideBanner(applicationId: string): Promise<boolean> {
  try {
    const account = await getOnboardingAccount();
    if (!isAfterLaunch(account.createdAt)) return false; // ancien compte : jamais
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("guide_application_id, fiche_banner_seen_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[onboarding] bandeau de la fiche", error.message);
      return false;
    }
    return data?.guide_application_id === applicationId && !data.fiche_banner_seen_at;
  } catch (error) {
    console.error("[onboarding] bandeau de la fiche", error);
    return false;
  }
}

/** Bandeau affiché dans le navigateur : noté comme vu (il ne réapparaîtra plus). */
export async function markGuideBannerSeen(applicationId: string) {
  if (!isSupabaseConfigured()) return; // mode démo : rien à enregistrer (et pas de redirection vers /login)
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_progress")
    .update({ fiche_banner_seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("guide_application_id", applicationId)
    .is("fiche_banner_seen_at", null);
  if (error) throw new Error(`Bandeau de la fiche : ${error.message}`);
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
      choice: state.choice,
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
      supabase.from("onboarding_progress").select("step, job_search, has_cv, choice, skipped_steps, completed_at"),
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
