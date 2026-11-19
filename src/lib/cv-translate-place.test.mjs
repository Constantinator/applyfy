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

// --- Commit 2 : action en place ---------------------------------------------------

const { contentFingerprint, mergeTranslation, newTranslationId, sameTranslation, translationFilter } = await import("./cv-translation-guard.ts");
const { fakeTranslateText, fakeTranslation, fakeTranslatorEnabled } = await import("./cv-translate-fake.ts");
const { runTranslation } = await import("./cv-translate.ts");

const PHOTO = `data:image/jpeg;base64,/9j/${"Q".repeat(40)}`;
const actionBody = () => {
  const source = read("app/actions/cv-builder.ts");
  return source.slice(source.indexOf("export async function translateCvAction"), source.indexOf("// « Importer un CV »"));
};
const at = (body, pattern) => {
  const index = body.search(pattern);
  assert.ok(index >= 0, String(pattern));
  return index;
};

test("schéma : translationId facultatif, gardé tel quel, valeur illisible retirée", () => {
  assert.equal(CvDataSchema.parse({}).translationId, undefined);
  assert.equal(CvDataSchema.parse({ translationId: "t-1" }).translationId, "t-1");
  for (const odd of [1, "", "x".repeat(65), null]) assert.equal(CvDataSchema.parse({ translationId: odd }).translationId, undefined);
  const id = newTranslationId();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.notEqual(id, newTranslationId());
});

test("garde : filtre « is null » pour un CV jamais traduit, « eq » sinon ; même règle sans base", () => {
  assert.deepEqual(translationFilter(null), { column: "data->>translationId", op: "is", value: null });
  assert.deepEqual(translationFilter("t-1"), { column: "data->>translationId", op: "eq", value: "t-1" });
  assert.equal(sameTranslation({}, {}), true);
  assert.equal(sameTranslation({ translationId: "t-1" }, { translationId: "t-1" }), true);
  assert.equal(sameTranslation({ translationId: "t-2" }, { translationId: "t-1" }), false);
  assert.equal(sameTranslation({ translationId: "t-1" }, {}), false);
});

test("empreinte du contenu : insensible au coach, à l'analyse, à la photo et à l'identifiant ; sensible à une puce", () => {
  const base = contentFingerprint(FR);
  assert.equal(contentFingerprint({ ...FR, coach: { opening: "Bonjour", contentKey: "k" } }), base);
  assert.equal(contentFingerprint({ ...FR, personal: { ...FR.personal, photo: PHOTO } }), base);
  assert.equal(contentFingerprint({ ...FR, translationId: "t-9" }), base);
  assert.equal(contentFingerprint({ ...FR, analysis: null }), base);
  const edited = { ...FR, experiences: [{ ...FR.experiences[0], bullets: [...FR.experiences[0].bullets, "Nouvelle puce"] }, ...FR.experiences.slice(1)] };
  assert.notEqual(contentFingerprint(edited), base);
  assert.notEqual(contentFingerprint({ ...FR, style: { ...FR.style, accent: "#123456" } }), base);
});

test("CV écrit : contenu traduit, photo, style, coach et analyse relus en base, nouvel identifiant", () => {
  const fresh = { ...FR, personal: { ...FR.personal, photo: PHOTO }, coach: { opening: "Salut", contentKey: "k2" } };
  const translated = { ...EN, personal: { ...EN.personal, photo: null }, coach: null };
  const merged = mergeTranslation(fresh, translated, "t-new");
  assert.equal(merged.summary, EN.summary);
  assert.equal(merged.personal.photo, PHOTO);
  assert.deepEqual(merged.style, fresh.style);
  assert.deepEqual(merged.coach, fresh.coach);
  assert.equal(merged.translationId, "t-new");
});

test("faux traducteur : seulement avec CV_TRANSLATE_FAKE=1 en développement, jamais en production", async () => {
  assert.equal(fakeTranslatorEnabled({ CV_TRANSLATE_FAKE: "1", NODE_ENV: "development" }), true);
  assert.equal(fakeTranslatorEnabled({ CV_TRANSLATE_FAKE: "1", NODE_ENV: "production" }), false);
  assert.equal(fakeTranslatorEnabled({ CV_TRANSLATE_FAKE: "1", NODE_ENV: "test" }), false);
  assert.equal(fakeTranslatorEnabled({ NODE_ENV: "development" }), false);
  assert.equal(fakeTranslatorEnabled({ CV_TRANSLATE_FAKE: "true", NODE_ENV: "development" }), false);
  assert.equal(fakeTranslateText("Le reporting et les budgets", "en"), "The reporting and the budgets");
  // Passe les vérifications du vrai déroulé : la langue du contenu bascule, dans les deux sens.
  for (const [cv, from, to] of [[FR, "fr", "en"], [EN, "en", "fr"]]) {
    const run = await runTranslation(cv, from, to, (fields) => fakeTranslation(fields, to));
    assert.equal(run.ok, true);
    assert.equal(cvContentLanguage(run.data), to);
  }
  const actions = read("app/actions/cv-builder.ts");
  assert.match(actions, /fakeTranslatorEnabled\(\)\s*\?\s*\(fields\) => fakeTranslation\(fields, to\)/);
});

test("action en place : contrôles avant le modèle, relecture, une seule écriture, quota après l'écriture", () => {
  const body = actionBody();
  assert.match(body, /export async function translateCvAction\(id: string, target: unknown\)/);
  const direction = at(body, /translationDirection\(source\.data\)/);
  const same = at(body, /target !== to/);
  const gate = at(body, /checkAiAccess\("cvb_traduction"\)/);
  const run = at(body, /runTranslation\(/);
  const reread = at(body, /const fresh = await getBuilderCv\(/);
  const guard = at(body, /contentFingerprint\(fresh\.data\) !== contentFingerprint\(source\.data\)/);
  const write = at(body, /writeTranslatedCv\(/);
  const usage = at(body, /recordAiUsage\("cvb_traduction"\)/);
  assert.ok(direction < same && same < gate && gate < run && run < reread && reread < guard && guard < write && write < usage);
  assert.equal((body.match(/recordAiUsage\(/g) ?? []).length, 1);
  assert.equal((body.match(/writeTranslatedCv\(/g) ?? []).length, 1);
  // Plus de copie : ni création, ni lien déplacé, ni limite des 20 CV.
  assert.doesNotMatch(body, /createBuilderCv|moveApplicationLink|countBuilderCvs|CV_BUILDER_MAX|translatedCvTitle|saveBuilderCv\(/);
  // Le navigateur reçoit le CV sans la photo.
  assert.match(body, /data: withoutPhoto\(written\)/);
  assert.match(body, /Ton CV est déjà en/);
  assert.match(body, /Ton CV a changé pendant la traduction/);
});

test("écriture de la traduction : data et language seulement, sur la même ligne, filtrée par l'identifiant", () => {
  const lib = read("lib/cv-builder.ts");
  const body = lib.slice(lib.indexOf("export async function writeTranslatedCv"), lib.indexOf("export async function deleteBuilderCv"));
  assert.match(body, /\.update\(\{ data, language \}\)/);
  assert.match(body, /\.eq\("id", id\)[\s\S]*\.eq\("user_id", user\.id\)/);
  assert.match(body, /translationFilter\(expected\)/);
  assert.doesNotMatch(body, /application_id|template_id|title|updated_at/);
  assert.doesNotMatch(lib, /export async function (moveApplicationLink|countBuilderCvs)/);
  assert.doesNotMatch(read("lib/cv-builder-types.ts"), /export function translatedCvTitle/);
});
