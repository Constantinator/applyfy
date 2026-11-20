// Recherche Logo.dev par nom, règle d'acceptation et calendrier (logo-dev-search.ts). Lancé par `npm test`.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { acceptSearch, matchRule, nextTryAt, searchLogoDev, upsertParams } = await import("./logo-dev-search.ts");

const c = (name, domain) => ({ name, domain });
const SECRET = "sk_test_ne_doit_jamais_apparaitre_0123456789";

test("acceptation : même clé → verified, quel que soit le rang du candidat", () => {
  assert.deepEqual(acceptSearch("KPMG France", [c("KPMG", "kpmg.com")]), {
    status: "verified", domain: "kpmg.com", candidate: c("KPMG", "kpmg.com"), rule: "same_key",
  });
  const sg = acceptSearch("Societe Generale", [c("SG Cowen", "cowen.com"), c("Société Générale", "societegenerale.com")]);
  assert.equal(sg.status, "verified");
  assert.equal(sg.domain, "societegenerale.com");
  assert.equal(acceptSearch("Crédit Agricole Cib", [c("Crédit Agricole CIB", "ca-cib.com"), c("Crédit Agricole", "credit-agricole.com")]).domain, "ca-cib.com");
  // Domaine renvoyé avec sous-domaine ou schéma : ramené au domaine principal.
  assert.equal(acceptSearch("Onepoint", [c("onepoint", "https://www.groupeonepoint.com/")]).domain, "groupeonepoint.com");
});

test("acceptation : suffixe bank / banque toléré (ING ↔ ING Bank), dans les deux sens", () => {
  const ing = acceptSearch("Ing bank n.v. france", [c("ING", "ing.com")]);
  assert.equal(ing.status, "verified");
  assert.equal(ing.rule, "bank_suffix");
  assert.equal(matchRule("ING", "ING Bank"), "bank_suffix");
  assert.equal(matchRule("Banque Postale", "Postale"), null); // seulement en fin de nom
  assert.equal(matchRule("BNP Paribas", "BNP Paribas"), "same_key");
});

test("acceptation : jamais group / groupe, international, holding(s) ni un homonyme partiel", () => {
  assert.deepEqual(acceptSearch("Groupe Alpha", [c("Alpha", "alpha.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Alpha Group", [c("Alpha", "alpha.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Alpha", [c("Alpha Group", "alphagroup.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Fidelity International", [c("Fidelity Investments", "fidelity.com"), c("Fidelity", "fidelity.com")]), { status: "none" });
  assert.equal(acceptSearch("Fidelity International", [c("Fidelity", "fidelity.com"), c("Fidelity International", "fidelityinternational.com")]).domain, "fidelityinternational.com");
  assert.deepEqual(acceptSearch("Heritage Holdings", [c("Heritage", "heritage.com")]), { status: "none" });
  // « Mazars Group » ne passe pas par la recherche : seulement par l'alias de la liste vérifiée.
  assert.deepEqual(acceptSearch("Mazars Group", [c("Mazars", "mazars.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Emalec", [c("Emale", "emale.fr"), c("Emalec Services", "emalecservices.com")]), { status: "none" });
});

test("acceptation : plusieurs domaines pour le même nom → ambiguous, avec les domaines en concurrence", () => {
  const result = acceptSearch("Alpha", [c("Alpha", "alpha.com"), c("ALPHA", "alpha.fr"), c("Alpha", "alpha.com")]);
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.competing, [c("Alpha", "alpha.com"), c("ALPHA", "alpha.fr")]);
  // Même domaine sous deux noms : pas d'ambiguïté.
  assert.equal(acceptSearch("ING Bank", [c("ING Bank", "ing.com"), c("ING", "ing.com")]).status, "verified");
});

test("acceptation : plateformes, domaines invalides et liste vide écartés", () => {
  assert.deepEqual(acceptSearch("Kepler Cheuvreux", [c("Kepler Cheuvreux", "keplercheuvreux.teamtailor.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Harmonie Mutuelle", [c("Harmonie Mutuelle", "media.licdn.com")]), { status: "none" });
  assert.deepEqual(acceptSearch("Acme", [c("Acme", "localhost"), c("Acme", "192.168.1.2"), c("Acme", "pas un domaine")]), { status: "none" });
  assert.deepEqual(acceptSearch("Acme", []), { status: "none" });
  // Une plateforme parmi les candidats n'empêche pas le bon domaine.
  assert.equal(acceptSearch("Acme", [c("Acme", "acme.lever.co"), c("Acme", "acme.com")]).domain, "acme.com");
});

test("nouveaux essais : none 7, 14, 28 jours puis plus rien ; ambiguous 30 jours une fois ; verified jamais", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const days = (date) => (date ? Math.round((date - now) / 86_400_000) : null);
  assert.deepEqual([1, 2, 3, 4].map((n) => days(nextTryAt("none", n, now))), [7, 14, 28, null]);
  assert.deepEqual([1, 2].map((n) => days(nextTryAt("ambiguous", n, now))), [30, null]);
  assert.equal(nextTryAt("verified", 1, now), null);
  assert.deepEqual(upsertParams(" KPMG France ", { status: "verified", domain: "kpmg.com", candidate: c("KPMG", "kpmg.com"), rule: "same_key" }, 1, now), {
    p_name_key: "kpmg", p_display_name: "KPMG France", p_domain: "kpmg.com", p_status: "verified", p_next_try_at: null,
  });
  assert.equal(upsertParams("Emalec", { status: "none" }, 1, now).p_domain, null);
});

const fakeFetch = (status, body, seen = []) => async (url, init) => {
  seen.push({ url, init });
  return { status, ok: status >= 200 && status < 300, json: async () => (typeof body === "function" ? body() : body) };
};

test("recherche : requête serveur avec la clé en en-tête, jamais dans l'adresse", async () => {
  const seen = [];
  const outcome = await searchLogoDev("KPMG France", {
    secretKey: SECRET,
    fetchImpl: fakeFetch(200, { data: [{ object: "search_result", name: "KPMG", domain: "kpmg.com", logo_url: "https://img.logo.dev/kpmg.com?token=pk" }, { name: "Sans domaine" }], metadata: {} }, seen),
  });
  assert.deepEqual(outcome, { kind: "ok", candidates: [c("KPMG", "kpmg.com")] });
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /^https:\/\/api\.logo\.dev\/v2\/search\?q=KPMG\+France&limit=10&method=match$/);
  assert.ok(!seen[0].url.includes(SECRET));
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${SECRET}`);
});

test("recherche : clé absente → aucune requête ; erreurs 400/401/402/429/500, réseau et réponse illisible sans exception ni secret", async () => {
  const seen = [];
  assert.deepEqual(await searchLogoDev("KPMG", { secretKey: "", fetchImpl: fakeFetch(200, { data: [] }, seen) }), { kind: "skipped" });
  assert.deepEqual(await searchLogoDev("KPMG", { secretKey: undefined, fetchImpl: fakeFetch(200, { data: [] }, seen) }), { kind: "skipped" });
  assert.equal(seen.length, 0);
  const cases = [
    [400, { kind: "error", reason: "bad_request", status: 400 }],
    [401, { kind: "stop", reason: "unauthorized", status: 401 }],
    [402, { kind: "stop", reason: "no_credits", status: 402 }],
    [429, { kind: "stop", reason: "rate_limited", status: 429 }],
    [500, { kind: "error", reason: "server", status: 500 }],
  ];
  for (const [status, expected] of cases) {
    const outcome = await searchLogoDev("KPMG", { secretKey: SECRET, fetchImpl: fakeFetch(status, { error: { message: `invalid ${SECRET}` } }) });
    assert.deepEqual(outcome, expected, String(status));
    assert.ok(!JSON.stringify(outcome).includes(SECRET));
  }
  const network = await searchLogoDev("KPMG", { secretKey: SECRET, fetchImpl: async () => { throw new Error(`échec ${SECRET}`); } });
  assert.deepEqual(network, { kind: "error", reason: "network", status: null });
  assert.deepEqual(await searchLogoDev("KPMG", { secretKey: SECRET, fetchImpl: fakeFetch(200, () => { throw new SyntaxError("json"); }) }), { kind: "error", reason: "invalid_response", status: 200 });
  assert.deepEqual(await searchLogoDev("KPMG", { secretKey: SECRET, fetchImpl: fakeFetch(200, { data: "x" }) }), { kind: "error", reason: "invalid_response", status: 200 });
  assert.deepEqual(await searchLogoDev("Inconnue", { secretKey: SECRET, fetchImpl: fakeFetch(200, { data: [] }) }), { kind: "ok", candidates: [] });
});
