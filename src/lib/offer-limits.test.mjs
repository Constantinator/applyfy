// Lien d'offre reçu dans l'adresse (?lien=). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

const { OFFER_URL_MAX_LENGTH, isHttpUrl, parseOfferLink } = await import("./offer-limits.ts");

test("lien http ou https : accepté, sans espaces autour", () => {
  assert.equal(parseOfferLink("https://exemple.fr/offre/12"), "https://exemple.fr/offre/12");
  assert.equal(parseOfferLink("  http://exemple.fr/offre "), "http://exemple.fr/offre");
});

test("tout le reste : refusé", () => {
  for (const value of ["", "   ", "pas un lien", "javascript:alert(1)", "ftp://exemple.fr", "file:///etc/passwd"]) {
    assert.equal(parseOfferLink(value), null, value);
  }
  assert.equal(parseOfferLink(undefined), null);
  assert.equal(parseOfferLink(["https://a.fr", "https://b.fr"]), null);
});

test("lien trop long : refusé", () => {
  const base = "https://exemple.fr/";
  assert.ok(parseOfferLink(base + "a".repeat(OFFER_URL_MAX_LENGTH - base.length)));
  assert.equal(parseOfferLink(base + "a".repeat(OFFER_URL_MAX_LENGTH)), null);
});

test("isHttpUrl", () => {
  assert.equal(isHttpUrl("https://exemple.fr"), true);
  assert.equal(isHttpUrl("exemple.fr"), false);
});
