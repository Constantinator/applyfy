// Lot sélecteur, anciens modèles : un CV sur l'un des 5 anciens modèles s'ouvre, s'exporte en PDF avec le
// même nombre de pages qu'avant et s'enregistre sans changer de modèle ; « Ton modèle actuel » est
// proposé dès l'ouverture et pendant toute la session. Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

await import("../../scripts/eval/register.mjs");

const SRC = new URL("../", import.meta.url);
const withExtension = (url) => [".ts", ".tsx", ""].map((ext) => new URL(url.href + ext)).find((u) => existsSync(u));
registerHooks({
  resolve(spec, ctx, next) {
    const base = spec.startsWith("@/") ? new URL(spec.slice(2), SRC) : spec.startsWith(".") && ctx.parentURL?.endsWith(".tsx") ? new URL(spec, ctx.parentURL) : null;
    const found = base && !/\.[a-z]+$/i.test(spec) ? withExtension(base) : null;
    return found ? { url: found.href, shortCircuit: true } : next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith(".tsx")) return next(url, ctx);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});

const { createElement } = await import("react");
const { renderToBuffer } = await import("@react-pdf/renderer");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { CvDocument, registerCvFonts } = await import("../components/cv-builder/cv-document.tsx");
const { CV_PICKER_TEMPLATES, CvDataSchema, LEGACY_TEMPLATE_IDS, isLegacyTemplate, readTemplateId, withoutEmptyLines } = await import("./cv-builder-types.ts");
const fixtures = await import("./cv-pdf-layout.fixtures.mjs");

registerCvFonts(fileURLToPath(new URL("../../public", import.meta.url)).replaceAll("\\", "/"));

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

async function pageCount(templateId, data) {
  const cv = withoutEmptyLines(CvDataSchema.parse(data));
  const buffer = await renderToBuffer(createElement(CvDocument, { data: cv, templateId, title: "CV de test", language: "fr" }));
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}

/** Pages des 5 anciens modèles sur main avant le lot (7e2daa9), pour les 3 contenus du banc PDF. */
const BEFORE = { court: 1, moyen: 1, dense: 2 };

test("les 5 anciens modèles : hors du sélecteur, toujours lus tels quels en base", () => {
  assert.deepEqual([...LEGACY_TEMPLATE_IDS], ["minimaliste", "classique", "moderne", "sidebar", "tech"]);
  for (const id of LEGACY_TEMPLATE_IDS) {
    assert.ok(isLegacyTemplate(id));
    assert.ok(!CV_PICKER_TEMPLATES.some((t) => t.id === id), id);
    // Ouverture : le modèle lu en base est gardé (pas de bascule sur Finance).
    assert.equal(readTemplateId(id), id);
  }
  assert.equal(isLegacyTemplate("finance"), false, "Finance est proposé");
  assert.equal(readTemplateId("inconnu"), "finance");
  assert.match(code("lib/cv-builder.ts"), /templateId: readTemplateId\(row\.template_id\)/);
});

for (const id of ["minimaliste", "classique", "moderne", "sidebar", "tech"]) {
  test(`PDF ${id} : même nombre de pages qu'avant le lot (court, moyen, dense)`, async () => {
    for (const [content, pages] of Object.entries(BEFORE)) {
      assert.equal(await pageCount(id, fixtures[content]), pages, `${id} / ${content}`);
    }
  });
}

test("enregistrement : le modèle du CV est renvoyé tel quel, l'action accepte les anciens modèles", () => {
  const editor = code("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /useState<CvTemplateId>\(cv\.templateId\)/);
  assert.match(editor, /saveBuilderCvAction\(cv\.id, \{ title, templateId, data: withoutPhoto\(data\), photo \}\)/);
  const actions = code("app/actions/cv-builder.ts");
  assert.match(actions, /if \(!isTemplateId\(input\?\.templateId\)\) return \{ ok: false, error: "Modèle inconnu\." \};/);
});

test("ancien modèle : mémorisé à l'ouverture, 7e carte « Ton modèle actuel » dès l'ouverture et toute la session", () => {
  const editor = code("components/cv-builder/cv-builder-editor.tsx");
  // Mémorisé à l'ouverture (la sauvegarde automatique écrase cv.templateId en base).
  assert.match(editor, /const \[originTemplate\] = useState\(cv\.templateId\);/);
  // Dès l'ouverture (cochée, puisque c'est le modèle du CV), et encore après l'avoir quitté.
  assert.match(editor, /origin=\{isLegacyTemplate\(originTemplate\) \? originTemplate : null\}/);
  assert.doesNotMatch(editor, /leftOrigin/);
  // Changer de modèle ne touche que le modèle : police, taille, marges, photo, accent restent dans `data`.
  const onTemplate = editor.slice(editor.indexOf("onTemplate={(id) => {"), editor.indexOf("onAccent="));
  assert.match(onTemplate, /setTemplateId\(id\);/);
  assert.doesNotMatch(onTemplate, /\bedit\(|setData\(/);

  const panel = code("components/cv-builder/cv-style-panel.tsx");
  assert.ok(
    panel.includes("Ce modèle n'est plus proposé. Tu peux le garder pendant cette session, ou passer à l'un des modèles ci-dessus.")
      || panel.includes("Ce modèle n&apos;est plus proposé. Tu peux le garder pendant cette session, ou passer à l&apos;un des modèles ci-dessus."),
  );
  assert.match(panel, /caption: "Ton modèle actuel"/);
  assert.doesNotMatch(panel, /modèle de départ/);
  // Hors compteur : la 7e carte n'est pas dans CV_PICKER_TEMPLATES.
  assert.equal(CV_PICKER_TEMPLATES.length, 6);
});
