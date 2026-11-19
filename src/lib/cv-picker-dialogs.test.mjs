// Lot sélecteur, les deux fenêtres : création depuis zéro (nom du compte + poste visé, le reste en barres)
// et import (le CV importé, gardé en mémoire de la page seulement). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { PLACEHOLDER_MARK, newCvPreviewData, thumbnailData } = await import("./cv-thumbnail.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

test("création depuis zéro : prénom et nom du compte + poste visé, le reste en barres grises", () => {
  const data = thumbnailData(newCvPreviewData({ firstName: "Léa", lastName: "Morel" }, "  Juriste d'affaires "));
  assert.equal(data.personal.firstName, "Léa");
  assert.equal(data.personal.lastName, "Morel");
  assert.equal(data.personal.jobTitle, "Juriste d'affaires");
  // Rien d'autre de réel : ni e-mail, ni ville, ni photo ; les rubriques sont des barres.
  assert.equal(data.personal.email, "");
  assert.equal(data.personal.city, "");
  assert.equal(data.personal.photo, null);
  assert.ok(data.summary.startsWith(PLACEHOLDER_MARK));
  assert.ok(data.experiences.every((e) => e.position.startsWith(PLACEHOLDER_MARK)));

  // Nom inconnu, poste pas encore saisi : barres grises, aucune personne inventée.
  const unknown = thumbnailData(newCvPreviewData(null, ""));
  for (const value of [unknown.personal.firstName, unknown.personal.lastName, unknown.personal.jobTitle]) {
    assert.ok(value.startsWith(PLACEHOLDER_MARK), value);
  }
});

test("création : nom du compte lu par la page, poste visé de l'étape 1, vignettes seulement fenêtre ouverte", () => {
  const page = code("app/(app)/cv-builder/page.tsx");
  assert.match(page, /getAccountName\(\)/);
  assert.match(page, /<NewCvDialog[\s\S]*?accountName=\{accountName\}/);
  const dialog = code("components/cv-builder/new-cv-dialog.tsx");
  assert.match(dialog, /newCvPreviewData\(accountName, targetJob\)/);
  // Contenu de la fenêtre rendu seulement quand elle est ouverte (fermeture : vignettes démontées).
  assert.match(dialog, /onClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(dialog, /\{open && \(/);
});

test("import : le CV importé, sans photo, gardé en mémoire de la page (ni URL, ni stockage, ni log)", () => {
  const actions = code("app/actions/cv-builder.ts");
  const extract = actions.slice(actions.indexOf("export async function extractCvImportAction"), actions.indexOf("async function importedCv("));
  assert.match(extract, /value: \{ id, data: withoutPhoto\(data\) \}/);
  const progress = code("components/cv-builder/cv-import-progress.tsx");
  assert.match(progress, /export type ImportedCv = \{ id: string; data: CvData;/);
  assert.match(progress, /p\.data = extracted\.value\.data;/);
  const flow = code("components/cv-builder/cv-import-flow.tsx");
  assert.match(flow, /<TemplateChoiceDialog[\s\S]*?data=\{imported\?\.data\}/);
  for (const [path, source] of [
    ["cv-import-progress.tsx", progress],
    ["cv-import-flow.tsx", flow],
    ["new-cv-dialog.tsx", code("components/cv-builder/new-cv-dialog.tsx")],
  ]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|URLSearchParams|history\.(push|replace)State/, path);
    for (const line of source.split("\n").filter((l) => /console\./.test(l))) assert.doesNotMatch(line, /\bdata\b/, `${path} : ${line.trim()}`);
  }
  // Fenêtre d'import : les vignettes ne sont rendues que pendant l'ouverture.
  assert.match(code("components/cv-builder/new-cv-dialog.tsx"), /\{open && \(\s*<div className="flex max-h-\[92vh\] flex-col">\s*<CvFontFaces \/>/);
});
