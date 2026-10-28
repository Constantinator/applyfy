import "server-only";

import { CV_IMPORT_FOLDER } from "./cv-builder-types";
import { createAdminClient } from "./supabase/admin";

// Tâche quotidienne (avec /api/cron/activation) : suppression des fichiers d'import du CV Builder
// abandonnés. Un fichier est supprimé dès l'extraction réussie ; il ne reste dans le bucket privé
// « documents » (<user_id>/cv-builder-import/…) que si l'import a été quitté en cours de route.

/** Âge au-delà duquel un fichier d'import est considéré comme abandonné. */
const MAX_AGE_MS = 24 * 3_600_000;
const PAGE_SIZE = 1000;

export type CvImportCleanupResult = { folders: number; deleted: number; dryRun: boolean };

/** Supprime les fichiers d'import de plus de 24 h. `dryRun` : compte sans rien supprimer. */
export async function cleanupCvImports({ dryRun = false, now = new Date() } = {}): Promise<CvImportCleanupResult> {
  const storage = createAdminClient().storage.from("documents");

  // Dossiers des utilisateurs à la racine du bucket (un par compte).
  const users: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.list("", { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`Liste des dossiers : ${error.message}`);
    users.push(...data.filter((item) => item.id === null).map((item) => item.name));
    if (data.length < PAGE_SIZE) break;
  }

  const old: string[] = [];
  for (const user of users) {
    const folder = `${user}/${CV_IMPORT_FOLDER}`;
    const { data, error } = await storage.list(folder, { limit: PAGE_SIZE });
    if (error) throw new Error(`Liste de ${folder} : ${error.message}`);
    for (const file of data) {
      const created = Date.parse(file.created_at ?? "");
      if (file.id !== null && Number.isFinite(created) && now.getTime() - created > MAX_AGE_MS) old.push(`${folder}/${file.name}`);
    }
  }

  if (!dryRun && old.length) {
    const { error } = await storage.remove(old);
    if (error) throw new Error(`Suppression : ${error.message}`);
  }
  return { folders: users.length, deleted: old.length, dryRun };
}
