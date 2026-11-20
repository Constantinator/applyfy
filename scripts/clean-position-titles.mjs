// Rattrapage des titres de candidatures déjà enregistrés (lot 2 du nettoyage des titres) :
// même règle qu'à l'import (tidyImportedTitle, src/lib/position-title.ts).
//
//   Simulation à blanc (par défaut, AUCUNE écriture) :  node scripts/clean-position-titles.mjs
//   Écriture, après relecture du rapport :              node scripts/clean-position-titles.mjs --apply
//   Retour arrière (position_original → position) :      node scripts/clean-position-titles.mjs --restore
//
// Périmètre : candidatures avec un lien d'offre, hors exemple, dont position_original est vide et
// dont le titre change. Une candidature sans lien d'offre n'est jamais touchée.
// --apply écrit position (nettoyé) et position_original (titre d'origine) en une seule mise à
// jour par candidature, par lots de 50, sans jamais écraser une position_original remplie.
// --restore recopie position_original dans position et la remet à null.
// Écriture seulement après une confirmation tapée (« o »). Lit NEXT_PUBLIC_SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY dans .env.local (ou l'environnement) sans jamais les afficher.
// Le rapport ne contient que des titres : ni identifiant, ni nom de personne.

import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createInterface } from "node:readline/promises";

registerHooks({
  resolve(specifier, context, next) {
    // Seulement pour les sources TypeScript du projet : jamais dans node_modules (require CJS).
    const fromProject = context.parentURL?.includes("/src/") && !context.parentURL.includes("/node_modules/");
    return next(fromProject && /^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});

const { runTitleBackfill } = await import("../src/lib/position-title-backfill.ts");
const { createClient } = await import("@supabase/supabase-js");

const ROOT = new URL("../", import.meta.url);
const APPLY = process.argv.includes("--apply");
const RESTORE = process.argv.includes("--restore");

const fail = (message) => {
  console.error(`ÉCHEC : ${message}`);
  process.exit(1);
};
if (APPLY && RESTORE) fail("--apply et --restore ne vont pas ensemble.");

// --- Configuration (valeurs jamais affichées) ------------------------------------------------
const fileEnv = existsSync(new URL(".env.local", ROOT))
  ? Object.fromEntries(
      readFileSync(new URL(".env.local", ROOT), "utf8")
        .split(/\r?\n/)
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
    )
  : {};
const env = (name) => process.env[name] || fileEnv[name] || "";
if (!env("NEXT_PUBLIC_SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
  fail("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente (.env.local).");
}
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mode = APPLY ? "apply" : RESTORE ? "restore" : "dry-run";
console.log(
  mode === "dry-run"
    ? "Simulation à blanc : aucune écriture en base."
    : `Mode ÉCRITURE (--${mode}) : confirmation demandée avant d'écrire.`,
);

// --- Lecture --------------------------------------------------------------------------------
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("applications")
    .select("id, position, position_original, company, location, offer_url, is_example")
    .order("created_at", { ascending: true })
    .range(from, from + 999);
  if (error) fail(`lecture des candidatures (${error.code ?? "erreur"}) : la migration 0042 est-elle lancée ?`);
  rows.push(...data);
  if (data.length < 1000) break;
}

// --- Écriture (une mise à jour par candidature, avec sa garde) ----------------------------------
async function updateRow(id, values, guard) {
  let query = db.from("applications").update(values).eq("id", id);
  query = guard === "original-null" ? query.is("position_original", null) : query.not("position_original", "is", null);
  const { data, error } = await query.select("id");
  if (error) {
    console.error(`  écriture refusée (${error.code ?? "erreur"})`);
    return false;
  }
  return data.length === 1;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n${question}`)).trim().toLowerCase();
  rl.close();
  return answer === "o";
}

await runTitleBackfill({ mode, rows, updateRow, confirm, log: (line) => console.log(line) });
