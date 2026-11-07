// Point faible du CV (carte « Ton CV »). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { READY_SCORE, weakestCategory } = await import("./cv-score.ts");

const score = (value, points) => ({
  score: value,
  corrections: [],
  categories: [
    { id: "impact", label: "Impact", max: 35, score: points[0] },
    { id: "content", label: "Contenu", max: 25, score: points[1] },
    { id: "keywords", label: "Mots-clés", max: 20, score: points[2] },
    { id: "concision", label: "Concision", max: 10, score: points[3] },
    { id: "form", label: "Forme", max: 10, score: points[4] },
  ],
});

test("catégorie qui a perdu le plus de points", () => {
  assert.equal(weakestCategory(score(60, [30, 20, 6, 8, 8]))?.label, "Mots-clés");
});

test("en points perdus, pas en pourcentage", () => {
  // Forme : 2/10 (8 points perdus) ; impact : 25/35 (10 points perdus).
  assert.equal(weakestCategory(score(60, [25, 25, 20, 10, 2]))?.id, "impact");
});

test("à égalité, l'ordre des catégories", () => {
  assert.equal(weakestCategory(score(70, [30, 20, 15, 10, 10]))?.id, "impact");
});

test("masqué à partir du score prêt à postuler", () => {
  assert.equal(weakestCategory(score(READY_SCORE, [20, 25, 15, 10, 10])), null);
  assert.ok(weakestCategory(score(READY_SCORE - 1, [20, 25, 15, 10, 9])));
});

test("détail indisponible : rien", () => {
  assert.equal(weakestCategory({ score: 50, corrections: [], categories: [] }), null);
  assert.equal(weakestCategory(score(50, [35, 25, 20, 10, 10])), null);
});
