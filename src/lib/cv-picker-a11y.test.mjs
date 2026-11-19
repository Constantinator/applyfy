// Lot sélecteur, accessibilité : groupe de boutons radio, flèches, un seul arrêt Tab, description lue
// par le lecteur d'écran sans nom visible, 2 colonnes sur mobile, cibles de 44 px. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { radioKeyTarget } = await import("./cv-thumbnail.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

test("flèches : suivant, précédent, en boucle ; Début et Fin ; les autres touches ne font rien", () => {
  assert.equal(radioKeyTarget("ArrowRight", 0, 6), 1);
  assert.equal(radioKeyTarget("ArrowDown", 4, 6), 5);
  assert.equal(radioKeyTarget("ArrowRight", 5, 6), 0, "en boucle");
  assert.equal(radioKeyTarget("ArrowLeft", 0, 6), 5, "en boucle");
  assert.equal(radioKeyTarget("ArrowUp", 3, 6), 2);
  assert.equal(radioKeyTarget("Home", 3, 7), 0);
  assert.equal(radioKeyTarget("End", 0, 7), 6, "7e carte comprise");
  for (const key of ["Tab", "Enter", " ", "a"]) assert.equal(radioKeyTarget(key, 2, 6), null, key);
});

test("grille : radiogroup, un seul arrêt Tab, aria-checked, description sans nom visible", () => {
  const grid = code("components/cv-builder/cv-style-panel.tsx");
  const start = grid.indexOf("export function TemplateGrid");
  const body = grid.slice(start, grid.indexOf("function Choices", start));
  assert.match(body, /role="radiogroup"/);
  assert.match(body, /aria-label="Modèles de CV"/);
  assert.match(body, /role="radio"/);
  assert.match(body, /aria-checked=\{active\}/);
  assert.doesNotMatch(body, /aria-pressed/);
  // Un seul arrêt Tab : la carte cochée (ou la première si aucune ne l'est).
  assert.match(body, /tabIndex=\{i === focusable \? 0 : -1\}/);
  assert.match(body, /radioKeyTarget\(e\.key, i, cards\.length\)/);
  assert.match(body, /aria-label=\{t\.label\}/);
  // Vignette décorative pour le lecteur d'écran (la description suffit).
  assert.match(grid, /aria-hidden="true" className="aspect-\[210\/297\]/);
  // 2 colonnes sur mobile, 3 au-delà ; cibles d'au moins 44 px.
  assert.match(body, /grid grid-cols-2 gap-3 sm:grid-cols-3/);
  assert.match(body, /min-h-11/);
  // La même grille partout : onglet Style, création et import.
  const dialog = code("components/cv-builder/new-cv-dialog.tsx");
  assert.equal(dialog.match(/<TemplateGrid /g)?.length, 2);
  assert.doesNotMatch(dialog, /role="radiogroup"|role="radio"/, "plus de seconde grille dans la fenêtre d'import");
});
