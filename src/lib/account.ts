import "server-only";

import { requireUser } from "./auth";
import { demoStore } from "./demo-data";
import { readAccountName, type AccountName } from "./person-name";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Prénom et nom du compte, stockés dans les métadonnées Supabase Auth (user_metadata :
// first_name, last_name), renseignées à l'inscription ou depuis « Mon profil ».

/** Prénom et nom de l'utilisateur connecté, ou null s'ils ne sont pas encore renseignés. */
export async function getAccountName(): Promise<AccountName | null> {
  if (!isSupabaseConfigured()) return demoStore.accountName ?? null;

  await requireUser();
  const supabase = await createClient();
  // getUser (et non les claims du JWT) : reflète aussitôt une modification faite depuis le profil.
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Lecture du compte impossible : ${error.message}`);
  return readAccountName(data.user?.user_metadata);
}

export async function saveAccountName(name: AccountName) {
  if (!isSupabaseConfigured()) {
    demoStore.accountName = name;
    return;
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { first_name: name.firstName, last_name: name.lastName },
  });
  if (error) throw new Error(`Enregistrement du nom impossible : ${error.message}`);
}
