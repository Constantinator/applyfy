// Table partagée company_domains (migration 0041), lecture groupée et garde-fous de la clé
// secrète Logo.dev. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { makeCompanyDomainsReader } = await import("./company-domains-read.ts");

const SRC = new URL("../", import.meta.url);
const sql = readFileSync(new URL("../../supabase/migrations/0041_company_domains.sql", import.meta.url), "utf8");
const code = sql.replace(/--.*$/gm, "");

test("migration 0041 : table additive, contraintes, RLS activée SANS aucune règle d'accès, accès retiré aux rôles publics", () => {
  assert.match(code, /create table if not exists company_domains \(/);
  assert.match(code, /name_key\s+text primary key check \(name_key ~ '\^\[a-z0-9\]\{2,120\}\$'\)/);
  assert.match(code, /source\s+text not null check \(source in \('curated', 'logo_dev_search', 'admin'\)\)/);
  assert.match(code, /status\s+text not null check \(status in \('verified', 'ambiguous', 'none', 'blocked'\)\)/);
  assert.match(code, /check \(status <> 'verified' or domain is not null\)/);
  assert.match(code, /alter table company_domains enable row level security;/);
  assert.doesNotMatch(code, /create policy/i);
  assert.match(code, /revoke all on company_domains from anon, authenticated;/);
  // Additive : rien de supprimé ni de modifié ailleurs.
  assert.doesNotMatch(code, /\bdrop\b|\bdelete\b|\btruncate\b|alter table (?!company_domains)/i);
});

test("migration 0041 : upsert_company_domain n'écrase jamais admin, blocked ni un domaine vérifié, et n'est exécutable que par service_role", () => {
  assert.match(code, /on conflict \(name_key\) do update set/);
  assert.match(code, /where c\.source <> 'admin'\s+and c\.status <> 'blocked'\s+and \(c\.status <> 'verified' or excluded\.status = 'verified'\);/);
  assert.match(code, /security invoker\s+set search_path = public/);
  assert.match(code, /revoke execute on function upsert_company_domain\(text, text, text, text, timestamptz\) from public, anon, authenticated;/);
  assert.match(code, /grant execute on function upsert_company_domain\(text, text, text, text, timestamptz\) to service_role;/);
  // Retour arrière documenté en tête.
  assert.match(sql, /-- Retour arrière : drop function if exists upsert_company_domain/);
});

const fakeClient = (result, calls = []) => ({
  from(table) {
    return {
      select(columns) {
        return { in: async (column, values) => (calls.push({ table, columns, column, values }), typeof result === "function" ? result() : result) };
      },
    };
  },
});

test("lecture groupée : une seule requête pour tous les noms (clés uniques), lignes indexées par nameKey", async () => {
  const calls = [];
  const read = makeCompanyDomainsReader(() => assert.fail("aucun journal attendu"));
  const table = await read(
    fakeClient({ data: [{ name_key: "kpmg", domain: "kpmg.com", status: "verified" }, { name_key: "groupealpha", domain: null, status: "none" }, { name_key: "x", status: "inconnu" }], error: null }, calls),
    ["KPMG France", "KPMG", "Groupe Alpha", null, "", "A"],
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { table: "company_domains", columns: "name_key, domain, status", column: "name_key", values: ["kpmg", "groupealpha"] });
  assert.deepEqual([...table], [["kpmg", { domain: "kpmg.com", status: "verified" }], ["groupealpha", { domain: null, status: "none" }]]);
  // Aucun nom : aucune requête.
  assert.equal((await read(fakeClient({ data: [], error: null }, calls), [null, ""])).size, 0);
  assert.equal(calls.length, 1);
});

test("lecture groupée : table absente (migration non lancée) ou erreur → table vide, un seul journal, sans secret", async () => {
  const logs = [];
  const read = makeCompanyDomainsReader((message) => logs.push(message));
  const missing = fakeClient({ data: null, error: { code: "42P01", message: 'relation "company_domains" does not exist' } });
  assert.equal((await read(missing, ["KPMG"])).size, 0);
  assert.equal((await read(missing, ["EY"])).size, 0);
  assert.equal((await read(fakeClient(() => { throw new Error("réseau"); }), ["EY"])).size, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^\[company-domains\] lecture impossible \(42P01\)/);
});

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = new URL(name, dir);
    return statSync(path).isDirectory() ? files(new URL(`${name}/`, dir)) : /\.tsx?$/.test(name) ? [path] : [];
  });

test("clé secrète Logo.dev : jamais dans un fichier client, jamais NEXT_PUBLIC, jamais dans un journal", () => {
  for (const path of files(SRC)) {
    const source = readFileSync(path, "utf8");
    const label = path.pathname.slice(SRC.pathname.length);
    assert.doesNotMatch(source, /NEXT_PUBLIC_LOGO_DEV_SECRET/, label);
    if (/^["']use client["']/m.test(source)) {
      assert.doesNotMatch(source, /LOGO_DEV_SECRET_KEY|secretKey|logo-dev-search|company-domains-store/, label);
    }
    for (const line of source.split("\n").filter((l) => /console\.(log|error|warn|info)/.test(l))) {
      assert.doesNotMatch(line, /secretKey|LOGO_DEV_SECRET_KEY|Authorization/, `${label} : ${line.trim()}`);
    }
  }
  // Le module de recherche ne lit pas l'environnement : la clé lui est passée par le serveur.
  assert.doesNotMatch(readFileSync(new URL("lib/logo-dev-search.ts", SRC), "utf8"), /process\.env/);
  assert.match(readFileSync(new URL("lib/company-domains-store.ts", SRC), "utf8"), /^import "server-only";/);
});
