// Lot sélecteur : 6 modèles proposés, Finance par défaut, compteur unique, aucun nom de modèle visible.
// Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { CV_DEFAULT_TEMPLATE, CV_PICKER_TEMPLATES, CV_TEMPLATE_IDS, isTemplateId } = await import("./cv-builder-types.ts");
const { LUMEO_APP_GUIDE } = await import("./lumeo-knowledge.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Source sans commentaires (les « // » des URL sont gardés). */
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

const LEGACY_IDS = ["minimaliste", "classique", "moderne", "sidebar", "tech"];
const LEGACY_NAMES = /\b(Minimaliste|Classique|Moderne bleu|Sidebar sombre|Tech moderne)\b/;

test("sélecteur : exactement les 6 modèles, dans l'ordre, aucun ancien", () => {
  assert.deepEqual(
    CV_PICKER_TEMPLATES.map((t) => t.id),
    ["finance", "serif-centre", "bandeau-droite", "lateral", "bandeau-gauche", "serif-compact"],
  );
  for (const id of LEGACY_IDS) assert.ok(!CV_PICKER_TEMPLATES.some((t) => t.id === id), id);
  // Chaque carte a une description (lecteur d'écran), jamais de nom.
  for (const t of CV_PICKER_TEMPLATES) {
    assert.ok(t.description.length > 20, t.id);
    assert.ok(!("name" in t), `${t.id} : pas de nom`);
  }
});

test("anciens modèles : toujours valides (base, validation, rendu), seulement retirés du sélecteur", () => {
  assert.equal(CV_TEMPLATE_IDS.length, 11);
  for (const id of LEGACY_IDS) assert.ok(isTemplateId(id), id);
});

test("modèle par défaut : Finance aux 6 endroits, plus aucun « minimaliste » par défaut", () => {
  assert.equal(CV_DEFAULT_TEMPLATE, "finance");
  const places = {
    "app/actions/cv-builder.ts": 2, // createBuilderCvAction, completeCvImportAction
    "lib/cv-builder.ts": 2, // toCv, createBuilderCv
    "components/cv-builder/cv-import-flow.tsx": 1, // « Passer cette étape »
    "components/cv-builder/new-cv-dialog.tsx": 2, // présélection des 2 fenêtres
  };
  for (const [path, count] of Object.entries(places)) {
    const source = code(path);
    assert.doesNotMatch(source, /["']minimaliste["']/, path);
    assert.equal(source.match(/\bCV_DEFAULT_TEMPLATE\b/g)?.length - 1, count, `${path} : import + ${count} usage(s)`);
  }
});

test("compteur : 6 modèles, lu à CV_PICKER_TEMPLATES.length partout, aucun chiffre écrit en dur", () => {
  assert.equal(CV_PICKER_TEMPLATES.length, 6);
  for (const path of ["app/page.tsx", "app/(app)/cv-builder/page.tsx", "lib/lumeo-knowledge.ts"]) {
    const source = code(path);
    assert.ok(source.includes("CV_PICKER_TEMPLATES.length"), path);
    assert.doesNotMatch(source, /CV_TEMPLATES\.length/, path);
    assert.doesNotMatch(source, /\b\d+ modèles/, path);
  }
  assert.match(LUMEO_APP_GUIDE, /\b6 modèles\b/);
});

test("garde-fou : aucun nom de modèle visible dans le sélecteur, les fenêtres et la bibliothèque", () => {
  for (const path of [
    "components/cv-builder/cv-style-panel.tsx",
    "components/cv-builder/new-cv-dialog.tsx",
    "components/cv-builder/cv-import-flow.tsx",
    "app/(app)/cv-builder/page.tsx",
  ]) {
    const source = code(path);
    assert.doesNotMatch(source, /\bt\.name\b|\.name as string|CV_TEMPLATES\.find\([^)]*\)\?\.name/, path);
    assert.doesNotMatch(source, LEGACY_NAMES, path);
  }
});

test("textes visibles : plus aucun nom d'ancien modèle de CV (blog, landing, guide de Lumeo)", () => {
  for (const path of ["lib/blog.ts", "app/page.tsx", "lib/lumeo-knowledge.ts"]) {
    assert.doesNotMatch(code(path), LEGACY_NAMES, path);
  }
});
