// Journaux d'échec des sources d'offres externes (france-travail.ts, adzuna.ts) : une ligne par
// échec, sans secret, sans nouvel essai ; et la fonction se termine même quand la réponse est
// dupliquée par le cache de Next (fetch avec next: { revalidate }). Lancé par `npm test`.
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

/**
 * Comme le fetch de Next avec next: { revalidate } : le corps est dupliqué (tee), une branche
 * part au cache (jamais lue ici), l'autre est rendue à l'appelant.
 */
const likeNextCache = (response) => {
  const [forCaller] = response.body.tee();
  return new Response(forCaller, { status: response.status, headers: response.headers });
};

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("appel inattendu");
    const response = typeof next === "function" ? next() : next;
    return init?.next?.revalidate ? likeNextCache(response) : response;
  };
  return calls;
}
const html = (status, body = "<!DOCTYPE html><html><title>Site en maintenance</title></html>", headers = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html;charset=UTF-8", server: "nginx", ...headers } });
const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

async function captureLogs(run) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => {
    const line = args.map(String).join(" ");
    if (line.startsWith("[")) lines.push(line); // avertissements de Node ignorés
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
    assert.doesNotMatch(line, /https?:\/\/|app_key=(?!\[masqué\])|app_id=(?!\[masqué\])|Bearer (?!\[masqué\])/, line);
  }
};
const SEARCH = { keywords: "analyste financier", department: null, contract: null, sort: "recent", page: 1 };

test("Adzuna : page nginx 400 en HTML (réponse dupliquée par le cache de Next) → se termine, une ligne, sans secret ni nouvel essai", { timeout: 3000 }, async () => {
  const calls = mockFetch([html(400, `<!DOCTYPE html><p class="details">nginx / 400</p> app_key=${SECRETS.ADZUNA_APP_KEY}&app_id=${SECRETS.ADZUNA_APP_ID}`, { "x-request-id": "az-1" })]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.equal(result.error?.constructor.name, "AdzunaError");
  assert.equal(result.error?.message, "Réponse inattendue d'Adzuna. Réessaie dans un instant.");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].init.next?.revalidate > 0, "même chemin de cache qu'avant (next: { revalidate })");
  assert.deepEqual(lines.length, 1);
  assert.match(lines[0], /^\[adzuna\] échec recherche : statut=400 type=text\/html;charset=UTF-8 server=nginx requête=az-1 corps="<!DOCTYPE html><p class=\\?"details\\?">nginx \/ 400/);
  assert.match(lines[0], /app_key=\[masqué\]&app_id=\[masqué\]/);
  assertNoSecret(lines);
});

test("Adzuna : réponse 200 en HTML → réponse inattendue ; 400 JSON, 429 JSON → messages inchangés, une ligne chacun", { timeout: 3000 }, async () => {
  mockFetch([html(200)]);
  let { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.match(result.error?.message ?? "", /Réponse inattendue d'Adzuna/);
  assert.equal(lines.length, 1);
  mockFetch([json(400, { exception: "BAD_REQUEST" })]);
  ({ result, lines } = await captureLogs(() => searchAdzuna(SEARCH)));
  assert.match(result.error?.message ?? "", /ne répond pas/);
  assert.match(lines[0], /statut=400 type=application\/json server=- requête=- corps="\{"exception":"BAD_REQUEST"\}"/);
  const calls = mockFetch([json(429, { exception: "RATE_LIMIT" })]);
  ({ result, lines } = await captureLogs(() => searchAdzuna(SEARCH)));
  assert.match(result.error?.message ?? "", /Trop de recherches/);
  assert.equal(calls.length, 1);
  assertNoSecret(lines);
});

test("Adzuna : réponse JSON réussie dupliquée par le cache → résultats, aucun journal", { timeout: 3000 }, async () => {
  mockFetch([json(200, { count: 0, results: [] })]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.deepEqual(result.value, { offers: [], total: 0 });
  assert.equal(lines.length, 0);
});

test("Adzuna : erreur réseau → une ligne sans adresse ni secret", { timeout: 3000 }, async () => {
  mockFetch([() => { throw Object.assign(new TypeError(`fetch failed ?app_key=${SECRETS.ADZUNA_APP_KEY}`), { cause: { code: "ECONNRESET" } }); }]);
  const { result, lines } = await captureLogs(() => searchAdzuna(SEARCH));
  assert.match(result.error?.message ?? "", /ne répond pas/);
  assert.deepEqual(lines, ["[adzuna] échec recherche : réseau (TypeError ECONNRESET)"]);
});

test("France Travail : page de maintenance en HTML au lieu du jeton → réponse inattendue, une ligne, sans secret", { timeout: 3000 }, async () => {
  const calls = mockFetch([html(200, `<html>Site en maintenance client_secret=${SECRETS.FRANCE_TRAVAIL_CLIENT_SECRET}</html>`, { server: "BigIP" })]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.equal(result.error?.constructor.name, "FranceTravailError");
  assert.equal(result.error?.message, "Réponse inattendue de France Travail. Réessaie dans un instant.");
  assert.equal(calls.length, 1);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[france-travail\] échec jeton : statut=200 type=text\/html;charset=UTF-8 server=BigIP requête=- corps="<html>Site en maintenance client_secret=\[masqué\]<\/html>"$/);
  assertNoSecret(lines);
});

test("France Travail : jeton refusé (400 JSON) → identifiants refusés, une ligne sans secret", { timeout: 3000 }, async () => {
  mockFetch([json(400, { error: "invalid_client", client_id: SECRETS.FRANCE_TRAVAIL_CLIENT_ID })]);
  const { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /identifiants refusés/);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /statut=400 type=application\/json/);
  assertNoSecret(lines);
});

test("France Travail : API en HTML après un jeton valide → réponse inattendue, une ligne ; 400 de la recherche journalisé", { timeout: 3000 }, async () => {
  const calls = mockFetch([json(200, { access_token: TOKEN, expires_in: 1500 }), html(200)]);
  let { result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123"));
  assert.match(result.error?.message ?? "", /Réponse inattendue de France Travail/);
  assert.equal(calls.length, 2);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[france-travail\] échec \/offres\/ABC123 : statut=200 type=text\/html/);
  mockFetch([json(500, { message: `erreur Bearer ${TOKEN}` })]);
  ({ result, lines } = await captureLogs(() => getFranceTravailOffer("ABC123")));
  assert.ok(result.error);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[france-travail\] échec offre : statut=500/);
  assertNoSecret(lines);
});
