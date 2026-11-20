// Rattrapage des titres de candidatures déjà enregistrés (lot 2 du nettoyage des titres) :
// logique pure du script scripts/clean-position-titles.mjs. La base est passée en paramètre
// (lecture, mise à jour d'une ligne, confirmation), ce qui rend le script testable sans Supabase.

import { tidyImportedTitle } from "./position-title";

export type TitleRow = {
  id: string;
  position: string | null;
  position_original: string | null;
  company: string | null;
  location: string | null;
  offer_url: string | null;
  is_example: boolean | null;
};

export type TitleChange = { id: string; before: string; after: string };

/** Mise à jour d'une ligne, avec sa garde : « original vide » (--apply) ou « original rempli » (--restore). */
export type UpdateRow = (
  id: string,
  values: { position: string; position_original: string | null },
  guard: "original-null" | "original-set",
) => Promise<boolean>;

export const BATCH_SIZE = 50;

/**
 * Titres à nettoyer : candidatures avec un lien d'offre, hors exemple, sans titre d'origine déjà
 * gardé, et dont le titre change. Une candidature sans lien d'offre n'est jamais touchée.
 */
export function planCleanup(rows: TitleRow[]): { changes: TitleChange[]; unchanged: number; outOfScope: number } {
  const changes: TitleChange[] = [];
  let unchanged = 0;
  let outOfScope = 0;
  for (const row of rows) {
    const position = row.position?.trim() ?? "";
    if (!row.offer_url?.trim() || row.is_example || row.position_original != null || !position) {
      outOfScope++;
      continue;
    }
    const after = tidyImportedTitle(position, { company: row.company, location: row.location }).slice(0, 160);
    if (after === row.position) unchanged++;
    else changes.push({ id: row.id, before: row.position ?? "", after });
  }
  return { changes, unchanged, outOfScope };
}

/** Titres à rétablir : toute candidature dont le titre d'origine est gardé. */
export function planRestore(rows: TitleRow[]): TitleChange[] {
  return rows
    .filter((row) => row.position_original != null && row.position_original !== "")
    .map((row) => ({ id: row.id, before: row.position ?? "", after: row.position_original as string }));
}

/** Écrit les changements par lots de 50 ; rend le nombre de lignes réellement mises à jour. */
export async function writeInBatches(
  items: TitleChange[],
  write: (item: TitleChange) => Promise<boolean>,
  batchSize = BATCH_SIZE,
): Promise<number> {
  let written = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const results = await Promise.all(items.slice(i, i + batchSize).map(write));
    written += results.filter(Boolean).length;
  }
  return written;
}

export type RunOptions = {
  mode: "dry-run" | "apply" | "restore";
  rows: TitleRow[];
  updateRow: UpdateRow;
  /** Pose la question et rend true seulement si l'utilisateur tape « o ». */
  confirm: (question: string) => Promise<boolean>;
  log: (line: string) => void;
};

/** Déroulé complet : rapport, puis écriture seulement en --apply / --restore et après « o ». */
export async function runTitleBackfill({ mode, rows, updateRow, confirm, log }: RunOptions) {
  if (mode === "restore") {
    const restores = planRestore(rows);
    log(`${restores.length} titre(s) à rétablir depuis position_original.`);
    for (const r of restores) log(`  ${r.before}  ←  ${r.after}`);
    if (restores.length === 0) return { written: 0 };
    if (!(await confirm(`Rétablir ${restores.length} titre(s) ? Tape « o » pour confirmer : `))) {
      log("Annulé : rien n'a été écrit.");
      return { written: 0 };
    }
    const written = await writeInBatches(restores, (r) =>
      updateRow(r.id, { position: r.after, position_original: null }, "original-set"),
    );
    log(`${written} titre(s) rétabli(s).`);
    return { written };
  }

  const { changes, unchanged, outOfScope } = planCleanup(rows);
  for (const c of changes) log(`  ${c.before}\n    → ${c.after}`);
  log(
    `${changes.length} titre(s) changeraient, ${unchanged} resteraient identiques, ${outOfScope} hors périmètre (sans lien d'offre, exemple, ou original déjà gardé).`,
  );
  if (mode === "dry-run") {
    log("Simulation à blanc : aucune écriture en base.");
    return { written: 0 };
  }
  if (changes.length === 0) return { written: 0 };
  if (!(await confirm(`Écrire ${changes.length} titre(s) nettoyé(s) ? Tape « o » pour confirmer : `))) {
    log("Annulé : rien n'a été écrit.");
    return { written: 0 };
  }
  const written = await writeInBatches(changes, (c) =>
    updateRow(c.id, { position: c.after, position_original: c.before }, "original-null"),
  );
  log(`${written} titre(s) nettoyé(s) ; titre d'origine gardé dans position_original.`);
  return { written };
}
