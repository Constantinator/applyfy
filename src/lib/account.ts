import "server-only";

import { cache } from "react";

import { requireUser } from "./auth";
import { demoStore } from "./demo-data";
import { isAfterLaunch } from "./onboarding";
import { readAccountName, type AccountName } from "./person-name";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Données du compte stockées dans les métadonnées Supabase Auth (user_metadata) :
// - first_name, last_name : renseignés à l'inscription ou depuis « Mon profil » ;
// - onboarding_completed_at : parcours d'accueil (/bienvenue) terminé.

/**
 * Métadonnées du compte connecté, lues une fois par rendu. getUser (et non les claims
 * du JWT) : reflète aussitôt une modification faite depuis l'application.
 */
const getAuthUser = cache(async () => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Lecture du compte impossible : ${error.message}`);
  return data.user;
});

const getUserMetadata = async () => (((await getAuthUser())?.user_metadata ?? {}) as Record<string, unknown>);

/** Prénom et nom de l'utilisateur connecté, ou null s'ils ne sont pas encore renseignés. */
export async function getAccountName(): Promise<AccountName | null> {
  if (!isSupabaseConfigured()) return demoStore.accountName ?? null;
  return readAccountName(await getUserMetadata());
}

export async function saveAccountName(name: AccountName) {
  if (!isSupabaseConfigured()) {
    demoStore.accountName = name;
    return;
  }
  await updateMetadata({ first_name: name.firstName, last_name: name.lastName });
}

/**
 * Le parcours d'accueil (/bienvenue) doit-il être proposé ? Seulement aux comptes créés après sa
 * mise en ligne (ONBOARDING_LAUNCHED_AT), tant qu'il n'est pas terminé. Jamais en mode démo.
 */
export async function needsOnboarding(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const user = await getAuthUser();
  if (!user || !isAfterLaunch(user.created_at)) return false;
  return typeof user.user_metadata?.onboarding_completed_at !== "string";
}

export async function completeOnboarding() {
  if (!isSupabaseConfigured()) {
    demoStore.onboardingCompleted = true;
    return;
  }
  await updateMetadata({ onboarding_completed_at: new Date().toISOString() });
}

async function updateMetadata(data: Record<string, string>) {
  await requireUser();
  const supabase = await createClient();
  // updateUser fusionne ces clés avec les métadonnées existantes.
  const { error } = await supabase.auth.updateUser({ data });
  if (error) throw new Error(`Enregistrement du compte impossible : ${error.message}`);
}
