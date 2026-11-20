// Lot logos 2b-2 : passage du dimanche (nouveaux essais des domaines). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { runDomainSweep, SWEEP_MAX_NAMES } = await import("./company-domain-sweep.ts");

const SECRET = "sk_test_SECRET_1234567890";
const NOW = new Date("2026-11-22T13:00:00Z");
const PAST = "2026-11-20T00:00:00Z";
const FUTURE = "2026-12-20T00:00:00Z";
const KNOWN = new Map([["kpmg", "kpmg.com"]]);

/**
 * Faux client Supabase : table company_domains (tableau de lignes) et candidatures (noms).
 * Les requêtes chaînées sont filtrées comme en base pour ce que le passage utilise.
 */
function fakeDb({ rows = [], companies = [], failOn = null } = {}) {
  const calls = { writes: [], searches: 0 };
  const table = rows.map((row) => ({ source: "logo_dev_search", attempts: 1, display_name: row.name_key, ...row }));
  function chain(name, columns, options) {
    const filters = [];
    let limit = Infinity;
    let range = null;
    const q = {
      in: (column, values) => (filters.push((r) => values.includes(r[column])), q),
      lte: (column, value) => (filters.push((r) => r[column] !== null && r[column] <= value), q),
      not: () => (filters.push((r) => r.company != null), q),
      order: () => q,
      limit: (n) => ((limit = n), q),
      range: (from, to) => ((range = [from, to]), q),
      eq: (column, value) => (filters.push((r) => r[column] === value), q),
      gte: () => q,
      then(resolve, reject) {
        if (failOn === name) return Promise.resolve({ data: null, error: { code: "XX000" } }).then(resolve, reject);
        if (options?.head) return Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject);
        let data = (name === "applications" ? companies.map((company) => ({ company })) : table).filter((r) => filters.every((f) => f(r)));
        data = range ? data.slice(range[0], range[1] + 1) : data.slice(0, limit);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  }
  const client = {
    from: (name) => ({ select: (columns, options) => chain(name, columns, options) }),
    rpc: (fn, params) => (calls.writes.push(params), Promise.resolve({ data: null, error: null })),
  };
  return { client, calls };
}

const fetchWith = (calls, respond) => async (url) => {
  calls.searches++;
  const name = new URL(url).searchParams.get("q");
  return respond(name);
};
const found = (name) => ({ status: 200, ok: true, json: async () => ({ data: [{ name, domain: `${name.toLowerCase().replace(/\W/g, "")}.com` }] }) });

async function sweep(db, options = {}) {
  const logs = [];
  const report = await runDomainSweep({
    client: db.client, secretKey: SECRET, known: KNOWN, log: (m) => logs.push(m), now: NOW,
    fetchImpl: fetchWith(db.calls, options.respond ?? found), ...options,
  });
  return { report, logs };
}

test("sélection : lignes dues d'abord (pas admin, pas pas-encore-dues), puis noms de candidatures absents de la table", async () => {
  const db = fakeDb({
    rows: [
      { name_key: "defontaine", display_name: "Defontaine", status: "none", next_try_at: PAST },
      { name_key: "pony", display_name: "Pony", status: "ambiguous", next_try_at: FUTURE },
      { name_key: "vestacy", display_name: "Vestacy", status: "verified", next_try_at: null },
      { name_key: "adminco", display_name: "AdminCo", status: "none", source: "admin", next_try_at: PAST },
      { name_key: "banquede", display_name: "Banque de France", status: "verified", next_try_at: null },
    ],
    companies: ["Vestacy", "Nouvelle Boîte", "Nouvelle Boîte", "KPMG France", "Banque de France", "Entreprise non communiquée", "Pony"],
  });
  const { report } = await sweep(db);
  assert.equal(report.due, 1);
  assert.equal(report.missing, 1); // seule « Nouvelle Boîte » ; Banque de France relue par l'ancienne clé
  assert.equal(report.selected, 2);
  assert.deepEqual(db.calls.writes.map((w) => w.p_name_key), ["defontaine", "nouvelleboite"]);
  assert.deepEqual(report.written, { verified: 2, ambiguous: 0, none: 0 });
});

test(`plafond par passage : ${SWEEP_MAX_NAMES} noms au plus, même si on en demande plus`, async () => {
  const companies = Array.from({ length: 80 }, (_, i) => `Societe Numero ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`);
  const db = fakeDb({ companies });
  const { report } = await sweep(db, { max: 500 });
  assert.equal(SWEEP_MAX_NAMES, 50);
  assert.equal(report.selected, 50);
  assert.equal(db.calls.searches, 50);
});

test("arrêt immédiat sur 401, 402 et 429 : aucune recherche après, rien écrit pour ce nom", async () => {
  for (const status of [401, 402, 429]) {
    const db = fakeDb({ companies: ["Alpha Un", "Beta Deux", "Gamma Trois"] });
    const { report, logs } = await sweep(db, { respond: () => ({ status, ok: false, json: async () => ({}) }) });
    assert.equal(db.calls.searches, 1, String(status));
    assert.equal(db.calls.writes.length, 0, String(status));
    assert.match(report.stopped, new RegExp(`${status}$`));
    for (const line of logs) assert.doesNotMatch(line, /sk_|SECRET|Bearer/);
  }
});

test("essai à blanc : sélection seulement, aucune recherche ni écriture ; bilan sans nom d'entreprise", async () => {
  const db = fakeDb({ companies: ["Nouvelle Boîte"] });
  const { report } = await sweep(db, { dryRun: true });
  assert.equal(report.selected, 1);
  assert.equal(db.calls.searches, 0);
  assert.equal(db.calls.writes.length, 0);
  assert.doesNotMatch(JSON.stringify(report), /Nouvelle|nouvelleboite/);
});

test("base en panne pendant la sélection : bilan en erreur, aucune recherche, jamais d'exception", async () => {
  const db = fakeDb({ companies: ["Nouvelle Boîte"], failOn: "company_domains" });
  const { report, logs } = await sweep(db);
  assert.match(report.error, /sélection impossible \(XX000\)/);
  assert.equal(db.calls.searches, 0);
  assert.equal(logs.length, 1);
});

test("route cron : même authentification que la collecte, ?dry=1, clé exigée hors essai à blanc, entrée le dimanche à 13 h UTC", () => {
  const route = readFileSync(new URL("../app/api/cron/domaines/route.ts", import.meta.url), "utf8");
  const collect = readFileSync(new URL("../app/api/cron/collecte/[secteur]/route.ts", import.meta.url), "utf8");
  const auth = (source) => source.slice(source.indexOf("function isAuthorized"), source.indexOf("\n}\n", source.indexOf("function isAuthorized")));
  assert.equal(auth(route), auth(collect));
  assert.match(route, /if \(!isAuthorized\(request\)\) \{\s+return Response\.json\(\{ error: "Non autorisé" \}, \{ status: 401 \}\);/);
  assert.match(route, /searchParams\.get\("dry"\) === "1"/);
  assert.match(route, /if \(!dryRun && !secretKey\)/);
  assert.match(route, /export const maxDuration = 300;/);
  const crons = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")).crons;
  assert.deepEqual(crons.find((c) => c.path === "/api/cron/domaines"), { path: "/api/cron/domaines", schedule: "0 13 * * 0" });
  assert.ok(crons.length <= 100, "limite Vercel : 100 crons par projet");
});
