// Traduction sur place (lot « traduction sur place ») : bouton unique dont la langue vient du
// contenu, titres des rubriques « contenu d'abord », sélecteur « Langue du CV » retiré.
// Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { translatableFields } = await import("./cv-translate.ts");
const { cvContentLanguage, cvTitleLanguage, translationDirection, translationText } = await import("./cv-translation-language.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fixture = (path) => JSON.parse(readFileSync(new URL(`../../scripts/eval/fixtures/${path}`, import.meta.url), "utf8"));
const FR = CvDataSchema.parse(fixture("profiles/dev/finance-junior-fr.json").cv);
const EN = CvDataSchema.parse(fixture("profiles/dev/tech-confirme-en.json").cv);
/** CV trop court pour décider : un titre et deux puces sans mot outil. */
const SHORT = CvDataSchema.parse({ personal: { jobTitle: "Data Analyst" }, experiences: [{ id: "e1", position: "Analyst", company: "Acme", bullets: ["SQL", "Python"] }] });

// --- Commit 1 : bouton unique, langue du contenu ---------------------------------

test("langue du contenu : français, anglais, indécidable pour un CV trop court", () => {
  assert.equal(cvContentLanguage(FR), "fr");
  assert.equal(cvContentLanguage(EN), "en");
  assert.equal(cvContentLanguage(SHORT), null);
  assert.equal(cvContentLanguage(CvDataSchema.parse({})), null);
});

test("bouton unique : la cible est l'autre langue que celle du CONTENU, jamais celle d'un réglage", () => {
  assert.deepEqual(translationDirection(FR), { from: "fr", to: "en" });
  assert.deepEqual(translationDirection(EN), { from: "en", to: "fr" });
  assert.equal(translationDirection(SHORT), null);
  // Le cas de Constantin : contenu français, colonne « en » laissée par l'ancien sélecteur.
  const panel = read("components/cv-builder/cv-translate-panel.tsx");
  assert.match(panel, /translationDirection\(data\)/);
  assert.doesNotMatch(panel, /language === "fr" \? "en" : "fr"/);
});

test("titres des rubriques : contenu d'abord, puis la colonne, puis le français", () => {
  assert.equal(cvTitleLanguage(FR, "en"), "fr");
  assert.equal(cvTitleLanguage(EN, "fr"), "en");
  assert.equal(cvTitleLanguage(SHORT, "en"), "en");
  assert.equal(cvTitleLanguage(SHORT, null), "fr");
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /const language: CvLang = cvTitleLanguage\(data, storedLanguage\)/);
});

test("texte lu pour la langue : exactement les champs traduisibles, sans photo ni coordonnées", () => {
  for (const cv of [FR, EN, SHORT]) {
    assert.equal(translationText(cv), translatableFields(cv).map((f) => f.text.trim()).join(" "));
  }
  const withContact = CvDataSchema.parse({ ...FR, personal: { ...FR.personal, email: "the.and@example.com", city: "The" } });
  assert.equal(translationText(withContact), translationText(FR));
});

test("sélecteur « Langue du CV » retiré de l'interface et du serveur", () => {
  assert.equal(existsSync(new URL("../components/cv-builder/cv-language-panel.tsx", import.meta.url)), false);
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.doesNotMatch(editor, /CvLanguagePanel|setCvLanguageAction|changeLanguage/);
  assert.doesNotMatch(read("app/actions/cv-builder.ts"), /setCvLanguageAction|setBuilderCvLanguage/);
  assert.doesNotMatch(read("lib/cv-builder.ts"), /setBuilderCvLanguage/);
});

test("action : la langue de départ vient du contenu enregistré ; indécidable : refus avant le modèle, sans quota", () => {
  const source = read("app/actions/cv-builder.ts");
  const body = source.slice(source.indexOf("export async function translateCvAction"), source.indexOf("// « Importer un CV »"));
  assert.doesNotMatch(body, /source\.language \?\?/);
  const direction = body.indexOf("translationDirection(source.data)");
  assert.ok(direction > 0);
  assert.ok(direction < body.indexOf('checkAiAccess("cvb_traduction")'));
  assert.ok(direction < body.indexOf("runTranslation("));
  assert.match(body, /error: TRANSLATION_TOO_SHORT/);
  assert.match(read("lib/cv-translation-language.ts"), /Ton CV est trop court pour savoir s.il est en français ou en anglais/);
});
