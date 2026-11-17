// Langue du CV (lot traduction, C1) : titres des rubriques et « Aujourd'hui / Present » dans la
// langue du CV, colonne cv_builder.language (migration 0039). Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CV_LANGS, CV_SECTION_TITLES, isCvLang } = await import("./cv-builder-types.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("titres des rubriques : mêmes clés en français et en anglais, aucun vide", () => {
  assert.deepEqual(CV_LANGS, ["fr", "en"]);
  assert.deepEqual(Object.keys(CV_SECTION_TITLES.en).sort(), Object.keys(CV_SECTION_TITLES.fr).sort());
  for (const lang of CV_LANGS) for (const value of Object.values(CV_SECTION_TITLES[lang])) assert.ok(value.trim());
  assert.equal(CV_SECTION_TITLES.fr.present, "Aujourd'hui");
  assert.equal(CV_SECTION_TITLES.en.present, "Present");
  assert.equal(CV_SECTION_TITLES.en.experiences, "Experience");
});

test("isCvLang : seulement fr et en", () => {
  assert.ok(isCvLang("fr") && isCvLang("en"));
  for (const value of ["FR", "de", "", null, undefined, 1]) assert.equal(isCvLang(value), false);
});

test("modèles : aucun titre de rubrique ni « Aujourd'hui » écrit en dur", () => {
  const source = read("components/cv-builder/cv-templates.tsx");
  assert.doesNotMatch(source, /<(Heading|SideHeading|MainHeading|FinanceHeading)>[^<{]/);
  assert.doesNotMatch(source, /<FinanceLine label="/);
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ""), /"Aujourd'hui"/);
});

test("aperçu et PDF reçoivent la langue ; le PDF la déclare", () => {
  assert.match(read("components/cv-builder/cv-document.tsx"), /language=\{language\}>/);
  assert.match(read("components/cv-builder/cv-builder-editor.tsx"), /<CvDocument [^>]*language=\{language\}/);
  assert.match(read("components/cv-builder/cv-builder-editor.tsx"), /<CvHtmlPreview\s+data=\{data\}\s+templateId=\{templateId\}\s+language=\{language\}/);
});

test("migration 0039 : colonne language nullable, fr ou en seulement", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/0039_cv_translation.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table cv_builder add column if not exists language text\s+check \(language is null or language in \('fr', 'en'\)\)/);
});

test("le sélecteur dit qu'il ne traduit pas le contenu", () => {
  assert.match(read("components/cv-builder/cv-language-panel.tsx"), /n&apos;est pas traduit/);
});
