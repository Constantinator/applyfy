import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "./auth";
import { cancelSubscriptionNow } from "./stripe";
import { getSubscription } from "./subscription";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";
import { createClient, isSupabaseConfigured } from "./supabase/server";

const BUCKET = "documents";

export class AccountDeletionError extends Error {}

/** Chemins de tous les fichiers d'un dossier du Storage, sous-dossiers compris. */
async function listFiles(supabase: SupabaseClient, folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, offset });
    if (error) throw new Error(`Lecture des fichiers impossible : ${error.message}`);
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      // Un dossier n'a pas d'id : on le parcourt.
      if (entry.id === null) paths.push(...(await listFiles(supabase, path)));
      else paths.push(path);
    }
    if (data.length < 100) return paths;
  }
}

/**
 * Supprime définitivement le compte de l'utilisateur connecté et toutes ses données :
 * 1. ses fichiers (CV du profil, documents), avec sa propre session (RLS) ;
 * 2. son abonnement Premium, résilié immédiatement chez Stripe (plus aucun prélèvement) ;
 * 3. son compte Supabase Auth, ce qui supprime en cascade candidatures, historique,
 *    documents, CV du profil, profil et abonnement (clés étrangères « on delete cascade »).
 * Fichiers et abonnement passent en premier : en cas d'échec, le compte reste intact.
 */
export async function deleteCurrentAccount() {
  if (!isSupabaseConfigured()) {
    throw new AccountDeletionError("La suppression de compte n'est pas disponible en mode démo.");
  }
  if (!isAdminConfigured()) {
    throw new AccountDeletionError("La suppression de compte n'est pas configurée sur ce site.");
  }

  // Identité vérifiée par Supabase : seul ce compte-là peut être supprimé.
  const user = await requireUser();
  const supabase = await createClient();

  const files = await listFiles(supabase, user.id);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) throw new Error(`Suppression des fichiers impossible : ${error.message}`);
  }

  const subscription = await getSubscription();
  if (subscription?.premium && subscription.stripeSubscriptionId) {
    await cancelSubscriptionNow(subscription.stripeSubscriptionId);
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Suppression du compte impossible : ${error.message}`);

  // Session locale (cookies) effacée : le compte n'existe plus côté Supabase.
  await supabase.auth.signOut({ scope: "local" });
}
