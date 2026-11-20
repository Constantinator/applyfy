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
 * Titres d'origine exclus du rattrapage (comparaison exacte) : le nettoyage les rendrait moins
 * bons que l'original (nom propre « Symfony » et accents absents ; entité « SWEN CP » en
 * minuscules). Relus et exclus par Constantin à la simulation du 20 novembre 2026 ; ils restent
 * tels quels, sans titre d'origine gardé.
 */
export const EXCLUDED_TITLES: ReadonlySet<string> = new Set([
  "DEVELOPPEUR PHP SYMFONY EXPERIMENTE H/F",
  "STAGE - ANALYSTE RISQUES (F/H) - SWEN CP",
]);

/**
 * Titres à nettoyer : candidatures avec un lien d'offre, hors exemple, sans titre d'origine déjà
 * gardé, et dont le titre change. Une candidature sans lien d'offre n'est jamais touchée.
 */
export function planCleanup(rows: TitleRow[]): {
  changes: TitleChange[];
  unchanged: number;
  outOfScope: number;
  excluded: number;
} {
  const changes: TitleChange[] = [];
  let unchanged = 0;
  let outOfScope = 0;
  let excluded = 0;
  for (const row of rows) {
    const position = row.position?.trim() ?? "";
    if (!row.offer_url?.trim() || row.is_example || row.position_original != null || !position) {
      outOfScope++;
      continue;
    }
    if (EXCLUDED_TITLES.has(row.position ?? "")) {
      excluded++;
      continue;
    }
    const after = tidyImportedTitle(position, { company: row.company, location: row.location }).slice(0, 160);
    if (after === row.position) unchanged++;
    else changes.push({ id: row.id, before: row.position ?? "", after });
  }
  return { changes, unchanged, outOfScope, excluded };
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
  /** Pose la question et rend la réponse tapée ("" si rien n'est tapé ou si l'entrée se ferme). */
  confirm: (question: string) => Promise<string>;
  log: (line: string) => void;
  /** Clavier interactif disponible (terminal) : sinon, seule --oui --attendu N permet d'écrire. */
  interactive?: boolean;
  /** --oui : confirmation déjà donnée à la lecture de la simulation ; exige --attendu. */
  preConfirmed?: boolean;
  /** --attendu N : nombre exact de titres à écrire, sinon refus. */
  expected?: number | null;
};

type Gate = Pick<RunOptions, "confirm" | "log" | "interactive" | "preConfirmed" | "expected">;

/**
 * Feu vert avant toute écriture. --oui : accepté seulement avec --attendu égal au nombre de
 * titres à écrire. Sans --oui : clavier interactif obligatoire, et seule la réponse « o » vaut
 * accord (réponse vide ou autre = annulé). Chaque refus dit pourquoi ; rien n'est écrit.
 */
export async function confirmWrite(count: number, question: string, gate: Gate): Promise<boolean> {
  const { confirm, log, interactive = true, preConfirmed = false, expected = null } = gate;
  if (expected != null && expected !== count) {
    log(`Refusé : ${count} titre(s) à écrire, mais --attendu ${expected}. Rien n'a été écrit.`);
    return false;
  }
  if (preConfirmed) {
    if (expected == null) {
      log(`Refusé : --oui exige --attendu N (nombre de titres relu dans la simulation, ici ${count}). Rien n'a été écrit.`);
      return false;
    }
    log(`${count} titre(s) à écrire (confirmé par --oui --attendu ${expected}).`);
    return true;
  }
  if (!interactive) {
    log(`Pas de clavier interactif : lance avec --oui --attendu ${count}, ou dans un vrai terminal pour taper « o ». Rien n'a été écrit.`);
    return false;
  }
  if ((await confirm(question)).trim().toLowerCase() !== "o") {
    log("Annulé : rien n'a été écrit.");
    return false;
  }
  return true;
}

/** Déroulé complet : rapport, puis écriture seulement en --apply / --restore et après le feu vert. */
export async function runTitleBackfill(options: RunOptions) {
  const { mode, rows, updateRow, log } = options;
  if (mode === "restore") {
    const restores = planRestore(rows);
    log(`${restores.length} titre(s) à rétablir depuis position_original.`);
    for (const r of restores) log(`  ${r.before}  ←  ${r.after}`);
    if (restores.length === 0) return { written: 0 };
    if (!(await confirmWrite(restores.length, `Rétablir ${restores.length} titre(s) ? Tape « o » pour confirmer : `, options))) {
      return { written: 0 };
    }
    const written = await writeInBatches(restores, (r) =>
      updateRow(r.id, { position: r.after, position_original: null }, "original-set"),
    );
    log(`${written} titre(s) rétabli(s).`);
    return { written };
  }

  const { changes, unchanged, outOfScope, excluded } = planCleanup(rows);
  for (const c of changes) log(`  ${c.before}\n    → ${c.after}`);
  log(
    `${changes.length} titre(s) changeraient, ${unchanged} resteraient identiques, ${excluded} exclu(s) par la liste, ${outOfScope} hors périmètre (sans lien d'offre, exemple, ou original déjà gardé).`,
  );
  if (mode === "dry-run") {
    log("Simulation à blanc : aucune écriture en base.");
    return { written: 0 };
  }
  if (changes.length === 0) return { written: 0 };
  if (!(await confirmWrite(changes.length, `Écrire ${changes.length} titre(s) nettoyé(s) ? Tape « o » pour confirmer : `, options))) {
    return { written: 0 };
  }
  const written = await writeInBatches(changes, (c) =>
    updateRow(c.id, { position: c.after, position_original: c.before }, "original-null"),
  );
  log(`${written} titre(s) nettoyé(s) ; titre d'origine gardé dans position_original.`);
  return { written };
}
