import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireUser } from "./auth";
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
 * 2. son compte Supabase Auth, ce qui supprime en cascade candidatures, historique,
 *    documents, CV du profil et profil (clés étrangères « on delete cascade »).
 * Les fichiers passent en premier : en cas d'échec, le compte reste intact et utilisable.
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

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Suppression du compte impossible : ${error.message}`);

  // Session locale (cookies) effacée : le compte n'existe plus côté Supabase.
  await supabase.auth.signOut({ scope: "local" });
}
