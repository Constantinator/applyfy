// Robustesse des sources d'offres externes (france-travail.ts, adzuna.ts) : maintenance, pages
// HTML, redirections, un seul nouvel essai, journaux sans secret. Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../", import.meta.url);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec.startsWith("@/")) {
      const file = fileURLToPath(new URL(`${spec.slice(2)}.ts`, SRC));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const SECRETS = {
  FRANCE_TRAVAIL_CLIENT_ID: "PAR_applyfy_identifiant_secret_1234",
  FRANCE_TRAVAIL_CLIENT_SECRET: "secret_france_travail_abcdef987654",
  ADZUNA_APP_ID: "adzid12345",
  ADZUNA_APP_KEY: "adzkey_tres_secrete_9876543210",
};
Object.assign(process.env, SECRETS);
const TOKEN = "jeton_acces_ne_doit_jamais_sortir_0042";

const { getFranceTravailOffer } = await import("./france-travail.ts");
const { searchAdzuna } = await import("./adzuna.ts");

/** fetch simulé : réponses servies dans l'ordre, appels enregistrés. */
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("appel inattendu");
    return typeof next === "function" ? next() : next;
  };
  return calls;
}
const html = (status, body = "<!DOCTYPE html><html><title>Site en maintenance</title>…</html>", headers = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html;charset=UTF-8", server: "nginx", ...headers } });
const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const token = () => json(200, { access_token: TOKEN, expires_in: 1500 });

/** Lignes de console.error des sources écrites pendant `run` (avertissements de Node ignorés). */
async function captureLogs(run) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    const line = args.map(String).join(" ");
    if (line.startsWith("[")) lines.push(line);
  };
  try {
    return { result: await run().then((value) => ({ value }), (error) => ({ error })), lines };
  } finally {
    console.error = original;
  }
}
const assertNoSecret = (lines) => {
  for (const line of lines) {
    for (const secret of [...Object.values(SECRETS), TOKEN]) assert.ok(!line.includes(secret), `secret dans le journal : ${line}`);
    assert.doesNotMatch(line, /https?:\/\/|app_key=(?!\[masqué\])|app_id=(?!\[masqué\])/, line);
  }
};
const SEARCH = { keywords: "analyste financier", department: null, contract: null, sort: "recent", page: 1 };

// Ordre important : le jeton France Travail est mis en cache au premier succès.

test("France Travail : redirection du serveur de jetons (page de secours) → maintenance, non suivie, sans nouvel essai", async () => {
  const calls = mockFetch([new Response(null, { status: 302, headers: { location: "https://secours-hp.francetravail.fr/accueil/", server: "BigIP" } })]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /France Travail est en maintenance/);
  assert.equal(result.error?.constructor.name, "FranceTravailError");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[france-travail\] échec jeton : statut=302 type=- server=BigIP requête=- corps=""$/);
  assertNoSecret(lines);
});

test("France Travail : page HTML du serveur de jetons → un seul nouvel essai après 400 ms, puis maintenance", async () => {
  const calls = mockFetch([html(200), html(200, "<html>Un incident est en cours</html>", { "x-request-id": "req-77" })]);
  const started = Date.now();
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /maintenance/);
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - started >= 380, "attente avant le nouvel essai");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /statut=200 type=text\/html;charset=UTF-8 server=nginx requête=req-77 corps="<html>Un incident est en cours<\/html>"/);
  assertNoSecret(lines);
});

test("France Travail : API qui répond en HTML → maintenance, un nouvel essai, une ligne de journal", async () => {
  const calls = mockFetch([token(), html(503), html(503)]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /maintenance/);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[france-travail\] échec offre : statut=503 type=text\/html/);
  assertNoSecret(lines);
});

test("France Travail : 429 JSON → aucun nouvel essai, message de limite", async () => {
  const calls = mockFetch([json(429, { message: "Too Many Requests" })]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /Trop de recherches/);
  assert.equal(calls.length, 1); // jeton en cache, pas de nouvel essai
  assert.equal(lines.length, 1);
  assert.match(lines[0], /statut=429 type=application\/json/);
});

test("France Travail : corps d'erreur qui renvoie les secrets → masqués dans le journal", async () => {
  mockFetch([json(500, { error: `client_secret=${SECRETS.FRANCE_TRAVAIL_CLIENT_SECRET} Bearer ${TOKEN} id ${SECRETS.FRANCE_TRAVAIL_CLIENT_ID}` }), json(500, { error: `access_token=${TOKEN} ${SECRETS.FRANCE_TRAVAIL_CLIENT_ID}` })]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.ok(result.error);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[masqué\]/);
  assertNoSecret(lines);
});

test("Adzuna : page nginx 400 en HTML → un seul nouvel essai, erreur claire, journal sans app_id ni app_key", async () => {
  const page = () => html(400, `<!DOCTYPE html><html><p class="details">nginx / 400</p> app_key=${SECRETS.ADZUNA_APP_KEY}&app_id=${SECRETS.ADZUNA_APP_ID}</html>`);
  const calls = mockFetch([page(), page()]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.equal(result.error?.message, "Adzuna est momentanément indisponible. Réessaie plus tard.");
  assert.equal(result.error?.constructor.name, "AdzunaError");
  assert.equal(calls.length, 2);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[adzuna\] échec recherche : statut=400 type=text\/html;charset=UTF-8 server=nginx requête=- corps="<!DOCTYPE html>/);
  assert.match(lines[0], /app_key=\[masqué\]&app_id=\[masqué\]/);
  assertNoSecret(lines);
});

test("Adzuna : 429 JSON → aucun nouvel essai ; 401 JSON → identifiants refusés", async () => {
  let calls = mockFetch([json(429, { exception: "RATE_LIMIT" })]);
  let { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.match(result.error?.message ?? "", /Trop de recherches/);
  assert.equal(calls.length, 1);
  assert.equal(lines.length, 1);
  assertNoSecret(lines);
  calls = mockFetch([json(401, { exception: "AUTH_FAIL" })]);
  ({ result, lines } = await captureLogs(() => searchAdzuna(SEARCH)));
  assert.match(result.error?.message ?? "", /identifiants refusés/);
  assert.equal(calls.length, 1);
});

test("Adzuna : 502 puis réponse JSON → le nouvel essai réussit, aucun journal ; réponse réussie non JSON → erreur claire", async () => {
  const calls = mockFetch([html(502), json(200, { count: 0, results: [] })]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.deepEqual(result.value, { offers: [], total: 0 });
  assert.equal(calls.length, 2);
  assert.equal(lines.length, 0);
  mockFetch([new Response("ok", { status: 200, headers: { "content-type": "text/plain" } })]);
  const plain = await captureLogs(() => searchAdzuna(SEARCH));
  assert.equal(plain.result.error?.message, "Adzuna est momentanément indisponible. Réessaie plus tard.");
  assert.equal(plain.lines.length, 1);
});

test("Adzuna : erreur réseau → une ligne sans adresse ni secret, aucun nouvel essai", async () => {
  const calls = mockFetch([() => { throw Object.assign(new TypeError(`fetch failed https://api.adzuna.com/?app_key=${SECRETS.ADZUNA_APP_KEY}`), { cause: { code: "ECONNRESET" } }); }]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.match(result.error?.message ?? "", /ne répond pas/);
  assert.equal(calls.length, 1);
  assert.deepEqual(lines, ["[adzuna] échec recherche : réseau (TypeError ECONNRESET)"]);
});
