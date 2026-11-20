// Lot logos 2b-1 : résolution du domaine en tâche de fond après la création d'une candidature,
// délai maximal de la lecture, ancienne clé, garde-fous (création jamais bloquée, aucun secret dans
// les journaux, aucune requête pendant le rendu). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { resolveCompanyDomain, isDue } = await import("./company-domain-resolve.ts");
const { makeCompanyDomainsReader } = await import("./company-domains-read.ts");

const SECRET = "sk_test_SECRET_1234567890";
const NOW = new Date("2026-11-20T10:00:00Z");
const KNOWN = new Map([["kpmg", "kpmg.com"]]);

/** Faux client Supabase : lignes de la table, compteurs, écritures enregistrées, pannes au choix. */
function fakeDb({ rows = [], counts = [0, 0], fail = null, hang = null } = {}) {
  const calls = { writes: [], reads: 0, counts: 0 };
  const answer = (kind, value) => {
    if (hang === kind) return new Promise(() => {});
    if (fail === kind) return Promise.resolve({ data: null, error: { code: "XX000", message: `panne ${SECRET}` } });
    if (fail === `${kind}-throw`) return Promise.reject(new Error("réseau"));
    return Promise.resolve(value);
  };
  const client = {
    from() {
      return {
        select(_columns, options) {
          return {
            in: () => (calls.reads++, answer("read", { data: rows, error: null })),
            eq: () => ({ gte: () => answer("count", { data: null, error: null, count: options ? counts[calls.counts++] ?? 0 : 0 }) }),
          };
        },
      };
    },
    rpc(fn, params) {
      calls.writes.push({ fn, params });
      return answer("write", { data: null, error: null });
    },
  };
  return { client, calls };
}

const okFetch = (candidates, seen = []) => async (url, init) => {
  seen.push({ url, init });
  return { status: 200, ok: true, json: async () => ({ data: candidates }) };
};
const statusFetch = (status) => async () => ({ status, ok: status < 400, json: async () => { throw new Error("html"); } });

async function run(name, { db = fakeDb(), fetchImpl = okFetch([]), secretKey = SECRET, caps } = {}) {
  const logs = [];
  const outcome = await resolveCompanyDomain(name, { client: db.client, secretKey, known: KNOWN, log: (m) => logs.push(m), now: NOW, fetchImpl, caps });
  return { outcome, logs, calls: db.calls };
}

test("nom nouveau : recherche, règle inchangée, une écriture par upsert_company_domain", async () => {
  const seen = [];
  const { outcome, calls, logs } = await run("Vestacy SAS", { fetchImpl: okFetch([{ name: "Vestacy", domain: "vestacy.com" }], seen) });
  assert.deepEqual(outcome, { kind: "written", status: "verified" });
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].fn, "upsert_company_domain");
  assert.equal(calls.writes[0].params.p_name_key, "vestacy");
  assert.equal(calls.writes[0].params.p_domain, "vestacy.com");
  assert.equal(logs.length, 0);
  // La clé part seulement dans l'en-tête Authorization, jamais dans l'adresse.
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.doesNotMatch(seen[0].url, /sk_/);
});

test("ambiguïté : jamais assouplie, initiales (ambiguous), aucun domaine écrit", async () => {
  const { outcome, calls } = await run("Pony", { fetchImpl: okFetch([{ name: "PONY", domain: "pony.com" }, { name: "Pony", domain: "getapony.com" }]) });
  assert.deepEqual(outcome, { kind: "written", status: "ambiguous" });
  assert.equal(calls.writes[0].params.p_domain, null);
});

test("aucune recherche : sans clé, nom de remplacement, nom trop court, liste vérifiée, ligne pas encore due, admin, blocked", async () => {
  const neverFetch = async () => assert.fail("aucune requête attendue");
  for (const [name, options, reason] of [
    ["Vestacy", { secretKey: "" }, "no_key"],
    ["Entreprise non communiquée", {}, "invalid_name"],
    ["A", {}, "invalid_name"],
    ["KPMG France", {}, "known"],
    ["Vestacy", { db: fakeDb({ rows: [{ name_key: "vestacy", display_name: "Vestacy", status: "verified", source: "logo_dev_search", attempts: 1, next_try_at: null }] }) }, "not_due"],
    ["Pony", { db: fakeDb({ rows: [{ name_key: "pony", display_name: "Pony", status: "ambiguous", source: "logo_dev_search", attempts: 1, next_try_at: "2026-12-20T00:00:00Z" }] }) }, "not_due"],
    ["Revio", { db: fakeDb({ rows: [{ name_key: "revio", display_name: "Revio", status: "blocked", source: "admin", attempts: 0, next_try_at: null }] }) }, "not_due"],
    ["Banque de France", { db: fakeDb({ rows: [{ name_key: "banquede", display_name: "Banque de France", status: "verified", source: "admin", attempts: 0, next_try_at: null }] }) }, "not_due"],
  ]) {
    const { outcome, calls } = await run(name, { fetchImpl: neverFetch, ...options });
    assert.deepEqual(outcome, { kind: "skipped", reason }, name);
    assert.equal(calls.writes.length, 0, name);
  }
});

test("nouvel essai dû (none passé) : recherche relancée ; isDue suit le calendrier de la table", async () => {
  const db = fakeDb({ rows: [{ name_key: "defontaine", display_name: "Defontaine", status: "none", source: "logo_dev_search", attempts: 1, next_try_at: "2026-11-19T00:00:00Z" }] });
  const { outcome } = await run("Defontaine", { db, fetchImpl: okFetch([]) });
  assert.deepEqual(outcome, { kind: "written", status: "none" });
  assert.equal(isDue(null, NOW), true);
  assert.equal(isDue({ status: "none", source: "admin", next_try_at: "2020-01-01T00:00:00Z" }, NOW), false);
  assert.equal(isDue({ status: "none", source: "logo_dev_search", next_try_at: null }, NOW), false);
});

test("plafonds jour et mois : aucune recherche au-delà", async () => {
  const neverFetch = async () => assert.fail("aucune requête attendue");
  const day = await run("Vestacy", { db: fakeDb({ counts: [300, 300] }), fetchImpl: neverFetch });
  assert.deepEqual(day.outcome, { kind: "skipped", reason: "cap" });
  const month = await run("Vestacy", { db: fakeDb({ counts: [0, 5000] }), fetchImpl: neverFetch });
  assert.deepEqual(month.outcome, { kind: "skipped", reason: "cap" });
});

test("Logo.dev en panne (401, 402, 429, 500, HTML, réseau) ou table en panne : rien n'est écrit, jamais d'exception, aucun secret journalisé", async () => {
  const cases = [
    ["401", { fetchImpl: statusFetch(401) }, "stop"],
    ["402", { fetchImpl: statusFetch(402) }, "stop"],
    ["429", { fetchImpl: statusFetch(429) }, "stop"],
    ["500", { fetchImpl: statusFetch(500) }, "error"],
    ["HTML 200", { fetchImpl: statusFetch(200) }, "error"],
    ["réseau", { fetchImpl: async () => { throw new Error(`ECONNRESET ${SECRET}`); } }, "error"],
    ["lecture table", { db: fakeDb({ fail: "read" }) }, "error"],
    ["lecture table (exception)", { db: fakeDb({ fail: "read-throw" }) }, "error"],
    ["comptage", { db: fakeDb({ fail: "count" }) }, "error"],
    ["écriture", { db: fakeDb({ fail: "write" }), fetchImpl: okFetch([{ name: "Vestacy", domain: "vestacy.com" }]) }, "error"],
  ];
  for (const [label, options, kind] of cases) {
    const { outcome, logs, calls } = await run("Vestacy", options);
    assert.equal(outcome.kind, kind, label);
    if (label !== "écriture") assert.equal(calls.writes.length, 0, label);
    assert.equal(logs.length, 1, label);
    for (const line of logs) assert.doesNotMatch(line, /sk_|SECRET|Bearer/, `${label} : ${line}`);
  }
});

test("base qui ne répond pas : la résolution s'arrête au délai maximal, sans exception", { timeout: 15_000 }, async () => {
  const started = Date.now();
  const { outcome } = await run("Vestacy", { db: fakeDb({ hang: "read" }) });
  assert.equal(outcome.kind, "error");
  assert.ok(Date.now() - started < 7_000);
});

test("lecture pour l'affichage : délai maximal de 3 s par défaut, puis table vide (la page n'attend pas)", async () => {
  const { READ_TIMEOUT_MS } = await import("./company-domains-read.ts");
  assert.ok(READ_TIMEOUT_MS <= 3_000);
  const logs = [];
  const read = makeCompanyDomainsReader((m) => logs.push(m), { timeoutMs: 50 });
  const hanging = { from: () => ({ select: () => ({ in: () => new Promise(() => {}) }) }) };
  const started = Date.now();
  assert.equal((await read(hanging, ["Vestacy"])).size, 0);
  assert.ok(Date.now() - started < 1_000);
  assert.match(logs[0], /lecture impossible \(délai dépassé\)/);
});

test("ancienne clé : la ligne « banquede » (Banque de France) reste lue ; jamais la ligne d'une autre entreprise", async () => {
  const read = makeCompanyDomainsReader(() => {});
  const calls = [];
  const client = {
    from: () => ({
      select: () => ({
        in: async (_column, values) => {
          calls.push(values);
          return {
            data: [
              { name_key: "banquede", display_name: "Banque de France", domain: "banque-france.fr", status: "verified" },
              { name_key: "air", display_name: "Air", domain: "air.com", status: "verified" },
            ],
            error: null,
          };
        },
      }),
    }),
  };
  const table = await read(client, ["Banque de France", "Air France"]);
  assert.deepEqual(calls[0], ["banquedefrance", "banquede", "airfrance", "air"]);
  assert.deepEqual(table.get("banquedefrance"), { domain: "banque-france.fr", status: "verified" });
  assert.equal(table.has("airfrance"), false);
  assert.equal(table.has("air"), false);
});

// --- Garde-fous statiques ------------------------------------------------------------------------

const SRC = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, SRC), "utf8");
const code = (path) => source(path).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = new URL(name, dir);
    return statSync(path).isDirectory() ? files(new URL(`${name}/`, dir)) : /\.tsx?$/.test(name) ? [path] : [];
  });

test("création : la résolution est planifiée APRÈS les insertions réussies, sans attente ni effet sur le résultat", () => {
  const apps = code("lib/applications.ts");
  const start = apps.indexOf("export async function createApplication(");
  const body = apps.slice(start, apps.indexOf("\n}\n", start));
  const schedule = body.indexOf("scheduleCompanyDomainResolution(fields.company);");
  assert.ok(schedule > body.indexOf("if (eventsError) throw"), "après l'insertion de l'événement");
  assert.ok(schedule < body.indexOf("return data.id as string;"), "avant le retour");
  assert.doesNotMatch(body, /await scheduleCompanyDomainResolution/);
  // Mode démo : retour avant la planification.
  assert.ok(body.indexOf("if (!isSupabaseConfigured())") < schedule);
});

test("tâche de fond : uniquement dans after(), toute erreur rattrapée (planification comprise), sans secret journalisé", () => {
  const store = code("lib/company-domains-store.ts");
  assert.match(store, /^import "server-only";/);
  const fn = store.slice(store.indexOf("export function scheduleCompanyDomainResolution"));
  assert.match(fn, /^export function scheduleCompanyDomainResolution\(company: string\): void \{\s+try \{/);
  assert.match(fn, /after\(async \(\) => \{\s+try \{\s+await resolveCompanyDomain\(/);
  assert.equal(store.match(/resolveCompanyDomain\(/g)?.length, 1);
  assert.match(fn, /\} catch \{\s+log\("\[company-domains\] tâche de fond non planifiée"\);/);
});

test("rien pendant le rendu : la recherche Logo.dev n'est importée par aucune page, aucun composant, aucune route", () => {
  const allowed = new Set(["lib/company-domain-resolve.ts", "lib/company-domains-store.ts", "lib/logo-dev-search.ts", "lib/applications.ts"]);
  for (const path of files(SRC)) {
    const label = path.pathname.slice(SRC.pathname.length);
    const text = readFileSync(path, "utf8");
    if (/logo-dev-search|company-domain-resolve|scheduleCompanyDomainResolution|searchLogoDev|resolveCompanyDomain/.test(text)) {
      assert.ok(allowed.has(label), `${label} ne doit pas lancer de recherche Logo.dev`);
    }
  }
  // Pages et composants n'appellent que la lecture (loadCompanyDomains), jamais la planification.
  for (const path of files(new URL("app/", SRC)).concat(files(new URL("components/", SRC)))) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /scheduleCompanyDomainResolution|LOGO_DEV_SECRET_KEY/, path.pathname);
  }
});
