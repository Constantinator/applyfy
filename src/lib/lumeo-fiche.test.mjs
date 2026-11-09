// Ligne de Lumeo sur la fiche d'une candidature. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { showLumeoSentLine } = await import("./lumeo-fiche.ts");
const { LUMEO_FICHE_TEXTS } = await import("./lumeo-texts.ts");
const { APPLICATION_STATUSES } = await import("./types.ts");

test("ligne affichée pour une candidature envoyée", () => {
  assert.equal(showLumeoSentLine({ status: "envoyee", is_example: false }), true);
  // Colonne absente (migration 0022 pas encore appliquée) : candidature réelle.
  assert.equal(showLumeoSentLine({ status: "envoyee" }), true);
});

test("jamais pour la candidature exemple", () => {
  assert.equal(showLumeoSentLine({ status: "envoyee", is_example: true }), false);
  assert.equal(showLumeoSentLine({ status: "en_attente", is_example: true }), false);
});

test("absente pour tous les autres statuts", () => {
  const others = APPLICATION_STATUSES.filter((s) => s !== "envoyee");
  assert.ok(others.includes("brouillon") && others.includes("en_attente"));
  for (const status of others) {
    assert.equal(showLumeoSentLine({ status, is_example: false }), false, status);
  }
});

test("texte de la ligne", () => {
  assert.equal(LUMEO_FICHE_TEXTS.sent, "Elle est partie. Je te préviens quand il sera temps de relancer.");
});
