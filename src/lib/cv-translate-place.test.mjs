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

// --- Commit 3 : concurrence avec la sauvegarde automatique ------------------------

/** cv-builder.ts en mode démo (sans base) : « server-only », alias « @/ » et next/* résolus pour Node. */
async function demoLibrary() {
  const { registerHooks } = await import("node:module");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const src = fileURLToPath(new URL("../", import.meta.url));
  registerHooks({
    resolve(spec, ctx, next) {
      if (spec === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
      if (spec.startsWith("@/")) {
        for (const ext of [".ts", ".tsx"]) {
          const file = `${src}${spec.slice(2)}${ext}`;
          if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
        }
      }
      if (/^next\/[a-z]+$/.test(spec)) return next(`${spec}.js`, ctx);
      return next(spec, ctx);
    },
  });
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return import("./cv-builder.ts");
}
const lib = await demoLibrary();
const { savedPhoto, PHOTO_UNCHANGED } = await import("./cv-photo.ts");
const { withEditorFields, withoutPhoto, withoutEmptyLines, fitCvData } = await import("./cv-builder-types.ts");

const FR_PHOTO = CvDataSchema.parse({ ...FR, personal: { ...FR.personal, photo: PHOTO } });
const EN_TRANSLATED = (await runTranslation(FR, "fr", "en", (fields) => fakeTranslation(fields, "en"))).data;

test("scénario rejoué : une sauvegarde française partie avant la traduction n'écrase jamais la traduction (photo « unchanged »)", async () => {
  const id = await lib.createBuilderCv(FR_PHOTO, "Mon CV", "finance");
  const before = await lib.getBuilderCv(id);
  // Traduction écrite (même ligne), nouvel identifiant.
  const translated = mergeTranslation(before.data, EN_TRANSLATED, "t-1");
  assert.equal(await lib.writeTranslatedCv(id, null, translated, "en"), true);
  // Sauvegarde automatique périmée : contenu français, photo « unchanged », sans identifiant.
  const stale = withoutPhoto(FR_PHOTO);
  const { photo } = savedPhoto(PHOTO_UNCHANGED, await lib.getBuilderCvPhoto(id));
  await assert.rejects(
    lib.saveBuilderCv(id, { title: "Mon CV", templateId: "finance", data: { ...stale, personal: { ...stale.personal, photo } } }),
    (error) => error instanceof lib.CvBuilderStaleError,
  );
  const after = await lib.getBuilderCv(id);
  assert.equal(after.data.summary, EN_TRANSLATED.summary);
  assert.equal(after.data.translationId, "t-1");
  assert.equal(after.data.personal.photo, PHOTO);
  assert.equal(after.language, "en");
  // Sauvegarde à jour (identifiant connu de l'éditeur) : acceptée.
  await lib.saveBuilderCv(id, { title: "Mon CV", templateId: "finance", data: { ...after.data, summary: "Edited summary" } });
  assert.equal((await lib.getBuilderCv(id)).data.summary, "Edited summary");
  // Une seconde traduction faite depuis un identifiant périmé n'écrit rien.
  assert.equal(await lib.writeTranslatedCv(id, null, translated, "en"), false);
  await lib.deleteBuilderCv(id);
});

test("CV jamais traduit : la sauvegarde passe (filtre « is null ») ; CV supprimé : « n'existe plus », pas « périmé »", async () => {
  const id = await lib.createBuilderCv(FR, "Mon CV", "finance");
  await lib.saveBuilderCv(id, { title: "Mon CV", templateId: "finance", data: { ...FR, summary: "Nouvelle accroche du CV" } });
  assert.equal((await lib.getBuilderCv(id)).data.summary, "Nouvelle accroche du CV");
  await lib.deleteBuilderCv(id);
  await assert.rejects(
    lib.saveBuilderCv(id, { title: "Mon CV", templateId: "finance", data: FR }),
    (error) => !(error instanceof lib.CvBuilderStaleError) && /n'existe plus/.test(error.message),
  );
});

test("copie d'un CV traduit (offre, Lumeo) : elle garde l'identifiant de l'original et s'enregistre librement", async () => {
  const translated = { ...EN_TRANSLATED, translationId: "t-orig" };
  const copy = await lib.createBuilderCv({ ...translated, coach: null }, "CV - Entreprise", "finance", "en");
  const stored = await lib.getBuilderCv(copy);
  assert.equal(stored.data.translationId, "t-orig");
  await lib.saveBuilderCv(copy, { title: "CV - Entreprise", templateId: "finance", data: { ...stored.data, interests: "Chess" } });
  assert.equal((await lib.getBuilderCv(copy)).data.interests, "Chess");
  await lib.deleteBuilderCv(copy);
  // Côté sources : les deux copies partent des données complètes du CV (identifiant compris).
  assert.match(read("app/actions/cv-builder.ts"), /createApplicationCv\(\{ \.\.\.source\.data, coach: null \}/);
  assert.match(read("lib/application-cv.ts"), /data: \{ \.\.\.data, targetJob, personal: \{ \.\.\.data\.personal, jobTitle \} \}/);
  assert.match(read("lib/lumeo-action-server.ts"), /applicationCvDraft\(/);
});

test("identifiant gardé par chaque écriture de data", () => {
  const cv = CvDataSchema.parse({ ...FR, translationId: "t-keep" });
  // Sauvegarde automatique : validation et nettoyage du serveur (fittedCv, withoutEmptyLines).
  assert.equal(withoutEmptyLines(fitCvData(withoutPhoto(cv)).data).translationId, "t-keep");
  assert.equal(CvDataSchema.parse(JSON.parse(JSON.stringify(cv))).translationId, "t-keep");
  // Modification du coach : contenu du chat + champs de l'éditeur, identifiant compris.
  const fromChat = JSON.parse(JSON.stringify({ ...cv, translationId: undefined, summary: "Accroche réécrite par le coach" }));
  const merged = CvDataSchema.parse(withEditorFields(fromChat, { ...cv, personal: { ...cv.personal, photo: PHOTO } }));
  assert.equal(merged.translationId, "t-keep");
  assert.equal(merged.summary, "Accroche réécrite par le coach");
  assert.equal(merged.personal.photo, PHOTO);
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /CvDataSchema\.safeParse\(withEditorFields\(parsed, current\)\)/);
  // Panneau Style : réglages, couleur, photo écrits sur la donnée complète.
  assert.match(editor, /onAccent=\{\(accent\) => edit\(\(d\) => \(\{ \.\.\.d, style: \{ \.\.\.d\.style, accent \} \}\)\)\}/);
  assert.match(editor, /onSettings=\{\(patch\) => edit\(\(d\) => \(\{ \.\.\.d, style: \{ \.\.\.d\.style, \.\.\.patch \} \}\)\)\}/);
  assert.match(editor, /onPhoto=\{\(photo\) => edit\(\(d\) => \(\{ \.\.\.d, personal: \{ \.\.\.d\.personal, photo \} \}\)\)\}/);
  // Écritures du serveur à partir de la ligne relue : premier message du coach, import.
  const actions = read("app/actions/cv-builder.ts");
  assert.match(actions, /data: \{ \.\.\.cv\.data, coach \}/);
  assert.match(actions, /data: \{ \.\.\.cv\.data, analysis \}/);
  assert.match(actions, /const data: CvData = \{ \.\.\.cv\.data, analysis, targetJob \}/);
});

test("serveur : sauvegarde filtrée par l'identifiant, réponse « périmée » distincte", () => {
  const source = read("lib/cv-builder.ts");
  const save = source.slice(source.indexOf("export async function saveBuilderCv"), source.indexOf("export async function writeTranslatedCv"));
  assert.match(save, /translationFilter\(translationIdOf\(data\)\)/);
  assert.match(save, /sameTranslation\(cv\.data, data\)/);
  assert.match(save, /throw new CvBuilderStaleError/);
  const actions = read("app/actions/cv-builder.ts");
  const body = actions.slice(actions.indexOf("export async function saveBuilderCvAction"), actions.indexOf("/** Suppression d'un CV"));
  assert.match(body, /error instanceof CvBuilderStaleError\) return \{ ok: false, stale: true, error: STALE_SAVE_MESSAGE \}/);
  assert.ok(body.indexOf("CvBuilderStaleError") < body.indexOf("error instanceof CvBuilderError"));
});

test("éditeur : sauvegarde en attente envoyée et attendue avant la traduction ; réponse périmée ignorée si une traduction l'a remplacée", () => {
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  // L'appel exact vérifié par le test de confidentialité est gardé.
  assert.match(editor, /saveBuilderCvAction\(cv\.id, \{ title, templateId, data: withoutPhoto\(data\), photo \}\)/);
  assert.match(editor, /async function flushSave\(\): Promise<boolean>/);
  assert.match(editor, /clearTimeout\(saveTimer\.current\)/);
  assert.match(editor, /await inFlight\.current/);
  assert.match(editor, /beforeTranslate=\{flushSave\}/);
  assert.match(editor, /\(dataRef\.current\.translationId \?\? null\) !== sent/);
  const panel = read("components/cv-builder/cv-translate-panel.tsx");
  const flush = panel.indexOf("await beforeTranslate()");
  assert.ok(flush > 0 && flush < panel.indexOf("translateCvAction(cvId, to)"));
  // Saisie bloquée : fenêtre modale, et Échap sans effet pendant la traduction.
  assert.match(panel, /showModal\(\)/);
  assert.match(panel, /if \(state\.step === "loading"\) event\.preventDefault\(\)/);
});

// --- Commit 4 : fenêtres (confirmation, quota épuisé, écran de fin, annulation) ------

const { offerLanguageWarning, translationQuotaUsed } = await import("./cv-translation-language.ts");
const { undoTranslationData } = await import("./cv-translation-guard.ts");

test("quota épuisé : message explicite (« Tu as utilisé ta traduction gratuite de ce mois »), jamais un bouton grisé seul", () => {
  assert.equal(translationQuotaUsed({ used: 0, limit: 1 }, "1er décembre"), null);
  assert.equal(translationQuotaUsed({ used: 5, limit: null }, "1er décembre"), null);
  assert.equal(
    translationQuotaUsed({ used: 1, limit: 1 }, "1er décembre"),
    "Tu as utilisé ta traduction gratuite de ce mois. La prochaine sera disponible le 1er décembre, ou tout de suite avec le Premium.",
  );
  assert.match(translationQuotaUsed({ used: 3, limit: 3 }, "1er décembre"), /^Tu as utilisé tes 3 traductions gratuites de ce mois\./);
  const panel = read("components/cv-builder/cv-translate-panel.tsx");
  assert.match(panel, /translationQuotaUsed\(usage, resetLabel\)/);
  assert.doesNotMatch(panel, /left === 0/);
});

test("avertissement : CV lié traduit dans une autre langue que celle de l'offre", () => {
  assert.equal(offerLanguageWarning("fr", "en"), "L'offre de cette candidature est en français : une fois ton CV en anglais, ses mots-clés de l'offre peuvent ne plus être reconnus et ton score peut baisser.");
  assert.equal(offerLanguageWarning("en", "en"), null);
  assert.equal(offerLanguageWarning(null, "en"), null);
  assert.match(offerLanguageWarning("en", "fr"), /^L'offre de cette candidature est en anglais : une fois ton CV en français/);
  const page = read("app/(app)/cv-builder/[id]/page.tsx");
  assert.match(page, /offerLanguage: offerLanguage\(detail\.application\)/);
  assert.match(read("components/cv-builder/cv-translate-panel.tsx"), /offerLanguageWarning\(application\?\.offerLanguage \?\? null, to\)/);
});

test("confirmation : contenu REMPLACÉ, traductions restantes, annulation possible juste après, quota non rendu", () => {
  const panel = read("components/cv-builder/cv-translate-panel.tsx");
  assert.match(panel, /Le contenu de ton CV, en \{LANG_NAME\[language\]\}, est remplacé par sa traduction \{TO_LABEL\[to\]\}/);
  assert.match(panel, /Traductions gratuites restantes ce mois : \$\{left\} sur \$\{usage\.limit\}/);
  assert.match(panel, /« Annuler la traduction » te sera proposé juste après/);
  assert.match(panel, /la traduction utilisée n&apos;est pas rendue/);
  assert.match(panel, /Ce CV reste celui de la candidature/);
  assert.doesNotMatch(panel, /copie/i);
});

test("écran de fin : champs gardés dans la langue d'origine, « Annuler la traduction » et « Fermer »", () => {
  const panel = read("components/cv-builder/cv-translate-panel.tsx");
  const done = panel.slice(panel.indexOf('state.step === "done"'), panel.indexOf('state.step === "undone"'));
  assert.match(done, /state\.value\.kept\.map/);
  assert.match(done, />\s*Annuler la traduction\s*</);
  assert.match(done, />\s*Fermer\s*</);
  assert.match(panel, /onUndo\(state\.snapshot, state\.value\.previousLanguage\)/);
  // Instantané pris APRÈS la sauvegarde envoyée, juste avant l'appel.
  assert.ok(panel.indexOf("await beforeTranslate()") < panel.indexOf("const snapshot = data;"));
  assert.ok(panel.indexOf("const snapshot = data;") < panel.indexOf("translateCvAction(cvId, to)"));
});

test("annulation : l'instantané revient par la sauvegarde normale, avec l'identifiant de la traduction et la photo affichée", () => {
  const snapshot = { ...FR, translationId: undefined, personal: { ...FR.personal, photo: null } };
  const current = { ...EN_TRANSLATED, translationId: "t-2", personal: { ...EN_TRANSLATED.personal, photo: PHOTO } };
  const back = undoTranslationData(snapshot, current);
  assert.equal(back.summary, FR.summary);
  assert.equal(back.translationId, "t-2");
  assert.equal(back.personal.photo, PHOTO);
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /edit\(\(d\) => undoTranslationData\(snapshot, d\)\)/);
  assert.match(editor, /restoreCvLanguageAction\(cv\.id, previousLanguage\)/);
  const actions = read("app/actions/cv-builder.ts");
  const body = actions.slice(actions.indexOf("export async function restoreCvLanguageAction"));
  assert.match(body.slice(0, 800), /restoreBuilderCvLanguage\(String\(id\), language\)/);
  const lib = read("lib/cv-builder.ts");
  const write = lib.slice(lib.indexOf("export async function restoreBuilderCvLanguage"), lib.indexOf("export async function deleteBuilderCv"));
  assert.match(write, /\.update\(\{ language \}\)/);
  assert.doesNotMatch(write, /data|application_id/);
});

test("annulation rejouée sur la bibliothèque : la sauvegarde normale passe la garde et rend le contenu d'origine", async () => {
  const id = await lib.createBuilderCv(FR_PHOTO, "Mon CV", "finance");
  // Instantané de l'éditeur (copie : le mode démo renvoie l'objet stocké).
  const before = structuredClone(await lib.getBuilderCv(id));
  const translated = mergeTranslation(before.data, EN_TRANSLATED, "t-3");
  assert.equal(await lib.writeTranslatedCv(id, null, translated, "en"), true);
  const back = undoTranslationData(before.data, translated);
  await lib.saveBuilderCv(id, { title: "Mon CV", templateId: "finance", data: back });
  await lib.restoreBuilderCvLanguage(id, null);
  const after = await lib.getBuilderCv(id);
  assert.equal(after.data.summary, FR.summary);
  assert.equal(after.data.translationId, "t-3");
  assert.equal(after.data.personal.photo, PHOTO);
  assert.equal(after.language, null);
  await lib.deleteBuilderCv(id);
});

// --- Commit 5 : message vrai quand le CV traduit ne passe pas la validation finale ------

const { applyTranslation, translatableFields: fieldsOf } = await import("./cv-translate.ts");

test("CV traduit invalide (CvDataSchema) : raison « invalid », distincte d'un excès de champs refusés", () => {
  const fields = fieldsOf(FR);
  // Texte accepté plus long que le schéma ne le permet (contrôle contourné) : la validation finale échoue.
  const accepted = new Map([["summary", "x".repeat(5000)]]);
  const result = applyTranslation(FR, fields, accepted, new Map(), "fr", "en");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid");
  assert.equal(result.kept.length, 0);
  const refused = applyTranslation(FR, fields, new Map(), new Map(fields.map((f) => [f.path, ["x"]])), "fr", "en");
  assert.equal(refused.reason, "refused");
  const body = actionBody();
  assert.match(body, /run\.reason === "invalid"/);
  assert.match(body, /Le CV traduit ne respecte pas nos règles d'enregistrement/);
  // Le message « pas assez fiable (N champs sur M refusés) » n'est plus donné que pour les refus.
  assert.match(body, /run\.reason === "refused"\s*\?\s*`La traduction n'est pas assez fiable/);
});

// --- Commit 6 : Lumeo dans l'éditeur note le CV ouvert -------------------------------

const lumeoPanel = await import("./lumeo-panel.ts");
const CV_ID = "3f2c1b8a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";

test("Lumeo : dans l'éditeur, la page porte l'id du CV ouvert ; ailleurs, rien ne change", () => {
  assert.deepEqual(lumeoPanel.lumeoLocation(`/cv-builder/${CV_ID}`), { page: "cv-builder", applicationId: null, cvId: CV_ID });
  assert.deepEqual(lumeoPanel.lumeoLocation(`/cv-builder/${CV_ID.toUpperCase()}?onglet=chat`), { page: "cv-builder", applicationId: null, cvId: CV_ID });
  assert.deepEqual(lumeoPanel.lumeoLocation("/cv-builder"), { page: "cv-builder", applicationId: null });
  assert.deepEqual(lumeoPanel.lumeoLocation("/cv-builder/importer"), { page: "cv-builder", applicationId: null });
  assert.deepEqual(lumeoPanel.lumeoLocation("/dashboard"), { page: "dashboard", applicationId: null });
  assert.deepEqual(lumeoPanel.parseLumeoLocation({ page: "cv-builder", cvId: CV_ID }), { page: "cv-builder", applicationId: null, cvId: CV_ID });
  assert.deepEqual(lumeoPanel.parseLumeoLocation({ page: "cv-builder" }), { page: "cv-builder", applicationId: null });
  assert.equal(lumeoPanel.parseLumeoLocation({ page: "cv-builder", cvId: "../x" }), null);
  // L'id du CV n'est lu que pour la page du CV Builder.
  assert.deepEqual(lumeoPanel.parseLumeoLocation({ page: "dashboard", cvId: CV_ID }), { page: "dashboard", applicationId: null });
  const panel = read("components/lumeo/lumeo-panel.tsx");
  assert.match(panel, /location\.cvId \? `\$\{location\.page\}:\$\{location\.cvId\}`/);
});

test("Lumeo : il note le CV ouvert (jamais « le dernier modifié ») et dit lequel, sans la photo", () => {
  const context = lumeoPanel.buildLumeoContext({
    location: { page: "cv-builder", applicationId: null, cvId: CV_ID },
    firstName: null,
    cv: { title: "CV Léa - Banque Fictive", score: 75, weakPoints: [], sector: "Finance", targetJob: "Analyste", experiences: [], skills: [] },
    applications: [],
    offer: null,
    now: new Date("2026-11-19T12:00:00Z"),
  });
  assert.match(context, /CV noté : « CV Léa - Banque Fictive » \(le CV ouvert dans l'éditeur\)/);
  assert.match(context, /Score du CV : 75\/100/);
  assert.match(context, /l'éditeur d'un CV/);
  assert.doesNotMatch(context, /photo|data:image/i);
  const action = read("app/actions/lumeo.ts");
  const body = action.slice(action.indexOf("async function lumeoCv"), action.indexOf("async function lumeoOffer"));
  assert.match(body, /const opened = cvId \? await getBuilderCv\(cvId\) : null/);
  assert.match(body, /if \(cvId && !opened\) return null/);
  assert.ok(body.indexOf("if (cvId && !opened) return null") < body.indexOf("getLatestBuilderCv()"));
  assert.match(body, /title: opened\.title/);
  assert.match(action, /lumeoCv\(detail, location\.cvId \?\? null\)/);
  assert.match(action, /parseLumeoLocation\(\{ page, applicationId: page === "fiche" \? id : undefined, cvId: page === "cv-builder" \? id : undefined \}\)/);
});
