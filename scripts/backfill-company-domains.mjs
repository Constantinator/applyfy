// Rattrapage des domaines d'entreprises (table company_domains, migration 0041) par la recherche
// Logo.dev, pour les noms déjà présents dans les candidatures et les offres collectées.
//
//   Simulation à blanc (par défaut, AUCUNE écriture) :  node scripts/backfill-company-domains.mjs
//   Écriture, après relecture du rapport :              node scripts/backfill-company-domains.mjs --apply
//   Option : --limit=200 (plafond de noms recherchés, 1 000 au plus).
//
// Lit NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et LOGO_DEV_SECRET_KEY dans .env.local
// (ou l'environnement) sans jamais les afficher. Aucun appel au modèle. Le rapport ne contient
// aucun identifiant d'utilisateur : nom affiché, clé, statut, candidat retenu, règle, concurrents.
// Arrêt immédiat sur 401 (clé refusée), 402 (crédits épuisés) ou 429 (limite par minute).
// --apply écrit seulement les résultats calculés (verified, ambiguous, none) par la fonction SQL
// upsert_company_domain, qui n'écrase jamais une ligne admin ni blocked, après une confirmation
// tapée (« o »).

import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createInterface } from "node:readline/promises";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});

const { nameKey, withAliases } = await import("../src/lib/company-domain.ts");
const { acceptSearch, searchLogoDev, upsertParams } = await import("../src/lib/logo-dev-search.ts");
const { createClient } = await import("@supabase/supabase-js");

const ROOT = new URL("../", import.meta.url);
const APPLY = process.argv.includes("--apply");
const MAX_NAMES = 1000;
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = Math.min(MAX_NAMES, Math.max(1, Number(limitArg?.slice(8)) || MAX_NAMES));
const BATCH = 50;
const PAUSE_MS = 150; // ≤ 400 recherches par minute (limite Community : 500)
const PLACEHOLDER_NAMES = new Set(["entreprisenoncommuniquee", "nonprecise", "confidentiel", "confidentielle"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message) => {
  console.error(`ÉCHEC : ${message}`);
  process.exit(1);
};

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
const SECRET = env("LOGO_DEV_SECRET_KEY");
if (!SECRET) fail("LOGO_DEV_SECRET_KEY absente (.env.local) : aucune recherche lancée.");
if (!env("NEXT_PUBLIC_SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) fail("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente (.env.local).");
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(APPLY ? "Mode ÉCRITURE (--apply) : confirmation demandée avant d'écrire." : "Simulation à blanc : aucune écriture en base.");

// --- Noms distincts des candidatures et des offres ---------------------------------------------
async function readNames(table) {
  const names = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("company").not("company", "is", null).range(from, from + 999);
    if (error) fail(`lecture de ${table} (${error.code ?? "erreur"})`);
    names.push(...data.map((row) => String(row.company).trim()).filter(Boolean));
    if (data.length < 1000) return names;
  }
}
const allNames = [...(await readNames("applications")), ...(await readNames("job_offers_raw"))];

// Variante la plus fréquente de chaque nom comme nom affiché.
const byKey = new Map();
for (const name of allNames) {
  const key = nameKey(name);
  if (key.length < 2 || PLACEHOLDER_NAMES.has(key)) continue;
  const variants = byKey.get(key) ?? new Map();
  variants.set(name, (variants.get(name) ?? 0) + 1);
  byKey.set(key, variants);
}
const displayName = (key) => [...byKey.get(key)].sort((a, b) => b[1] - a[1])[0][0];

// --- Noms déjà connus : liste vérifiée (et alias), puis table ----------------------------------
const known = new Map();
for (const company of Object.values(JSON.parse(readFileSync(new URL("src/lib/ats-companies.json", ROOT), "utf8"))).flat()) {
  known.set(nameKey(company.name), company.domain);
}
for (const [, name, domain] of readFileSync(new URL("src/lib/job-boards.ts", ROOT), "utf8").matchAll(/name: "([^"]+)", domain: "([^"]+)"/g)) {
  known.set(nameKey(name), domain);
}
const curated = withAliases(known);

const existing = new Map();
let tableMissing = false;
const keys = [...byKey.keys()].filter((key) => !curated.has(key));
for (let i = 0; i < keys.length; i += 200) {
  const { data, error } = await db.from("company_domains").select("name_key, status, source, attempts, next_try_at").in("name_key", keys.slice(i, i + 200));
  if (error) {
    tableMissing = true;
    break;
  }
  for (const row of data) existing.set(row.name_key, row);
}
if (tableMissing) {
  if (APPLY) fail("table company_domains illisible : lance d'abord la migration 0041.");
  console.log("Attention : table company_domains illisible (migration 0041 pas encore lancée ?). Tous les noms sont traités comme nouveaux.");
}
const now = new Date();
const due = (row) =>
  !row || (row.source !== "admin" && (row.status === "none" || row.status === "ambiguous") && row.next_try_at && new Date(row.next_try_at) <= now);
const todo = keys.filter((key) => due(existing.get(key)));
const skipped = keys.length - todo.length;
const selected = todo.slice(0, LIMIT);

console.log(
  `${byKey.size} noms distincts ; ${byKey.size - keys.length} dans la liste vérifiée ; ${skipped} déjà dans la table (vérifiés, bloqués, admin ou prochain essai plus tard) ; ` +
    `${todo.length} à rechercher${todo.length > LIMIT ? `, limités à ${LIMIT}` : ""}.`,
);

// --- Recherches -------------------------------------------------------------------------------
const results = [];
const errors = [];
let stop = null;
let searches = 0;
search: for (let i = 0; i < selected.length; i += BATCH) {
  for (const key of selected.slice(i, i + BATCH)) {
    const name = displayName(key);
    const outcome = await searchLogoDev(name, { secretKey: SECRET });
    searches += outcome.kind === "skipped" ? 0 : 1;
    if (outcome.kind === "stop") {
      stop = outcome;
      break search;
    }
    if (outcome.kind === "error" || outcome.kind === "skipped") {
      errors.push({ name, key, reason: outcome.kind === "error" ? `${outcome.reason}${outcome.status ? ` ${outcome.status}` : ""}` : "ignoré" });
    } else {
      results.push({ name, key, acceptance: acceptSearch(name, outcome.candidates), attempts: (existing.get(key)?.attempts ?? 0) + 1 });
    }
    await sleep(PAUSE_MS);
  }
  console.log(`… ${Math.min(i + BATCH, selected.length)} / ${selected.length}`);
}

// --- Rapport ----------------------------------------------------------------------------------
const cell = (text) => String(text).replaceAll("|", "/");
const verified = results.filter((r) => r.acceptance.status === "verified").sort((a, b) => (a.acceptance.rule === b.acceptance.rule ? a.key.localeCompare(b.key) : a.acceptance.rule === "same_key" ? -1 : 1));
const ambiguous = results.filter((r) => r.acceptance.status === "ambiguous").sort((a, b) => a.key.localeCompare(b.key));
const none = results.filter((r) => r.acceptance.status === "none").sort((a, b) => a.key.localeCompare(b.key));

console.log("\n| Nom affiché | Clé | Statut proposé | Candidat retenu (nom → domaine) | Règle / domaines en concurrence |");
console.log("|---|---|---|---|---|");
for (const r of verified) {
  const { candidate, rule } = r.acceptance;
  console.log(`| ${cell(r.name)} | ${r.key} | verified | ${cell(candidate.name)} → ${candidate.domain} | ${rule === "same_key" ? "clé identique" : "suffixe bank / banque"} |`);
}
for (const r of ambiguous) {
  console.log(`| ${cell(r.name)} | ${r.key} | ambiguous | — | ${r.acceptance.competing.map((c) => `${cell(c.name)} → ${c.domain}`).join(" ; ")} |`);
}
for (const r of none) console.log(`| ${cell(r.name)} | ${r.key} | none | — | — |`);
for (const e of errors) console.log(`| ${cell(e.name)} | ${e.key} | erreur (non écrit) | — | ${e.reason} |`);

console.log(
  `\nRésumé : ${verified.length} verified (${verified.filter((r) => r.acceptance.rule === "same_key").length} clé identique, ` +
    `${verified.filter((r) => r.acceptance.rule === "bank_suffix").length} suffixe bank / banque), ${ambiguous.length} ambiguous, ` +
    `${none.length} none, ${errors.length} en erreur ; ${searches} recherches (≈ ${(searches / 1000).toFixed(3)} crédit Logo.dev).`,
);
if (stop) {
  const why = { unauthorized: "clé LOGO_DEV_SECRET_KEY refusée (401)", no_credits: "crédits Logo.dev épuisés (402)", rate_limited: "limite par minute atteinte (429)" }[stop.reason];
  console.log(`ARRÊT : ${why}. Les noms restants n'ont pas été recherchés.`);
}

// --- Écriture (--apply seulement, après confirmation) -----------------------------------------
if (!APPLY) {
  console.log("\nSimulation à blanc : rien n'a été écrit. Relance avec --apply après relecture du rapport.");
  process.exit(stop ? 1 : 0);
}
if (stop) fail("arrêt sur erreur Logo.dev : aucune écriture. Relance plus tard.");
const toWrite = [...verified, ...ambiguous, ...none];
if (toWrite.length === 0) {
  console.log("Rien à écrire.");
  process.exit(0);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`\nÉcrire ${toWrite.length} lignes dans company_domains (${verified.length} verified, ${ambiguous.length} ambiguous, ${none.length} none) ? Tape « o » pour confirmer : `)).trim().toLowerCase();
rl.close();
if (answer !== "o") {
  console.log("Annulé : rien n'a été écrit.");
  process.exit(0);
}
let written = 0;
for (const r of toWrite) {
  const { error } = await db.rpc("upsert_company_domain", upsertParams(r.name, r.acceptance, r.attempts, now));
  if (error) fail(`écriture interrompue après ${written} lignes (${error.code ?? "erreur"}).`);
  written += 1;
}
console.log(`${written} lignes écrites (les lignes admin et blocked n'ont pas été modifiées).`);
