// Design « noir + bleu » de l'éditeur du CV Builder et de la page lettre. Lancé par `npm test`.
// Le mode sombre n'est pas concerné (classes dark: laissées telles quelles), ni les couleurs des
// CV eux-mêmes (modèles, pastilles d'accent), écrites en valeurs et non en classes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** Fichiers passés au nouveau design, ajoutés commit par commit. */
const FILES = [
  "components/cv-builder/cv-builder-editor.tsx",
  "components/application/refine-chat.tsx",
  "components/cv-builder/cv-score-card.tsx",
  "components/application/missing-points-panel.tsx",
  "components/cv-builder/cv-style-panel.tsx",
  "components/application/font-combobox.tsx",
  "components/cv-builder/cv-content-panel.tsx",
  "components/cv-builder/form-controls.tsx",
  "components/application/cv-editor.tsx",
  "app/(app)/candidatures/[id]/lettre/page.tsx",
];

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// Rendu de la lettre elle-même (texte du document, comme un modèle de CV) : hors du design de l'interface.
const read = (path) => source(path).replace(/const letterStyles = \[[\s\S]*?\]\.join\(" "\);/, "");
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Classes du mode clair : jetons des chaînes de classes, sans ceux qui portent la variante dark:. */
function lightClasses(path) {
  const strings = withoutComments(read(path)).match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  return strings
    .flatMap((literal) => literal.slice(1, -1).split(/[\s"'`{}$]+/))
    .filter(Boolean)
    .filter((token) => !token.split(":").slice(0, -1).includes("dark"));
}
const base = (token) => token.split(":").pop();
const offenders = (rule) => FILES.flatMap((path) => lightClasses(path).filter(rule).map((token) => `${path} : ${token}`));

test("éditeur et lettre : plus d'ancien bleu (blue-600 vaut #1E40AF dans le thème), ni slate, indigo ou violet", () => {
  assert.deepEqual(offenders((token) => /^-?[a-z-]+-(?:blue|slate|indigo|violet)-\d{2,3}(?:\/\d+)?$/.test(base(token))), []);
  assert.deepEqual(FILES.filter((path) => /\[#1e40af\]|--color-blue-600/i.test(read(path))), []);
});

test("éditeur et lettre : anciennes classes card, btn-* et input remplacées par les classes ui-*", () => {
  const legacy = /^(?:card|input|btn-primary|btn-secondary|btn-danger)$/;
  // Une chaîne d'un seul mot hors className est une valeur (size="card"), pas une classe.
  const words = (path) =>
    (withoutComments(read(path)).match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? []).filter((literal) => /\s/.test(literal.slice(1, -1)));
  const found = FILES.flatMap((path) =>
    words(path)
      .flatMap((literal) => literal.slice(1, -1).split(/[\s"'`{}$]+/))
      .filter((token) => legacy.test(base(token)) && !token.startsWith("dark:"))
      .map((token) => `${path} : ${token}`),
  );
  const single = FILES.filter((path) => /className=(["'`])(?:card|input|btn-primary|btn-secondary|btn-danger)\1/.test(read(path)));
  assert.deepEqual([...found, ...single], []);
});

test("éditeur et lettre : aucune ombre ni dégradé (impression mise à part)", () => {
  assert.deepEqual(
    offenders((token) => /^(?:shadow(?!-none$)|bg-gradient|bg-linear|from-|via-)/.test(base(token)) && !token.startsWith("print:")),
    [],
  );
});

test("onglets de l'éditeur : pilules, inactives lisibles, cible de 44 px sur mobile", () => {
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  const tab = /role="tab"[\s\S]*?className=\{`([^`]*)`/.exec(editor)?.[1] ?? "";
  assert.match(tab, /ui-hit/);
  assert.match(tab, /rounded-full/);
  // Inactif : texte #3F3F46 (prose) sur #F4F4F5 (box), contraste de 9,7:1.
  assert.match(tab, /bg-box font-medium text-prose/);
});

test("aperçu du CV : feuille blanche sur fond gris très léger", () => {
  assert.match(read("components/cv-builder/cv-builder-editor.tsx"), /bg-\[#F7F7F8\] p-4/);
});

test("bandeaux d'avertissement : ambre et rose gardés, bandeau mobile bordé pour rester visible", () => {
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /text-amber-700/);
  assert.match(editor, /text-rose-600/);
  assert.match(editor, /fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-amber-300 bg-amber-100/);
});

test("score : couleurs de la jauge inchangées (rouge, orange, vert)", () => {
  const score = read("components/cv-builder/cv-score-card.tsx");
  for (const color of ["#dc2626", "#f97316", "#16a34a"]) assert.ok(score.includes(color), color);
});

test("style du CV : modèle choisi bordé de noir, pastilles de 44 px sur mobile, couleurs des CV inchangées", () => {
  const panel = read("components/cv-builder/cv-style-panel.tsx");
  assert.match(panel, /\? "border-ink /);
  assert.match(panel, /h-11 w-11 rounded-full[^"`]*lg:h-8 lg:w-8/);
  // Couleur du modèle « Moderne » : couleur du CV, pas de l'interface.
  assert.match(panel, /moderne: "#1E40AF"/);
});

test("formulaire du CV : boutons d'icône et de suppression de 44 px sur mobile", () => {
  const controls = read("components/cv-builder/form-controls.tsx");
  const content = read("components/cv-builder/cv-content-panel.tsx");
  assert.match(controls, /const iconButton =\s*"[^"]*min-h-11 min-w-11/);
  assert.match(content, /const removeButton =\s*"[^"]*min-h-11 min-w-11/);
  assert.match(content, /const arrow =\s*"[^"]*min-h-11 min-w-11/);
});

test("lettre : rendu du document inchangé (couleurs du texte de la lettre)", () => {
  const editor = source("components/application/cv-editor.tsx");
  assert.match(editor, /const letterStyles = \[\s*"text-slate-800 leading-\[1\.4\]",/);
  assert.match(editor, /\[&_h1\+p\]:text-slate-600/);
});

test("lettre : feuille sur fond #F7F7F8 sans ombre, surlignage jaune gardé, page toujours en clair", () => {
  const editor = read("components/application/cv-editor.tsx");
  assert.match(editor, /rounded-card bg-\[#F7F7F8\] p-4 print:overflow-visible print:rounded-none print:bg-transparent print:p-0/);
  assert.match(editor, /\[&_mark\]:bg-yellow-200/);
  assert.match(read("app/(app)/candidatures/[id]/lettre/page.tsx"), /data-theme-off/);
});

test("fond de l'application : blanc, mode sombre inchangé", () => {
  const body = /<body className="([^"]*)"/.exec(source("app/layout.tsx"))?.[1] ?? "";
  assert.match(body, /(^| )bg-white( |$)/);
  assert.match(body, /(^| )text-ink( |$)/);
  assert.match(body, /dark:bg-slate-950 dark:text-slate-100/);
  assert.doesNotMatch(body, /(^| )bg-slate-50( |$)/);
});
