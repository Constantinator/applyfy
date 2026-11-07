// Garde-fous de la landing : couleurs, promesses et repli sans JavaScript. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Source sans commentaires (les « // » des URL sont gardés). */
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

const LANDING_FILES = [
  "app/page.tsx",
  "app/opengraph-image.tsx",
  "components/landing/count-up.tsx",
  "components/landing/demo-dashboard.tsx",
  "components/landing/feature-previews.tsx",
  "components/landing/hero-visual.tsx",
  "components/landing/mobile-cta-bar.tsx",
  "components/landing/reveal.tsx",
  "components/site/site-header.tsx",
  "components/site/site-mobile-menu.tsx",
];

const code = (path) => withoutComments(read(path));
const page = code("app/page.tsx");

test("plus d'ancien bleu ni de couleur décorative (blue-600 vaut #1E40AF dans le thème)", () => {
  const old = /#1e40af|\b(?:text|bg|border|ring|from|to)-blue-[5-9]00\b|indigo-\d|violet-\d|\bslate-|text-brand|bg-brand|(?<!ui-)btn-(?:primary|secondary)/i;
  assert.deepEqual(LANDING_FILES.filter((path) => old.test(code(path))), []);
});

test("aucune promesse « illimité », ni « pour toujours » ; « Sans carte bancaire » présent", () => {
  assert.deepEqual(LANDING_FILES.filter((path) => /illimit|sans limite|pour toujours/i.test(code(path))), []);
  assert.match(page, /Sans carte bancaire/);
});

test("aucun prix en euros écrit en dur sur la landing", () => {
  // Autorisé : « {constante} € ». Interdit : « 12 € ».
  assert.deepEqual(page.match(/\d ?€/g), null);
});

test("nombre de modèles, de points et de places lus dans le code", () => {
  assert.doesNotMatch(page, /\b\d+ modèles|\b\d+ places|\b\d+ points/);
  for (const name of ["CV_TEMPLATES.length", "SCORE_TOTAL", "BETA_MAX_TESTERS", "BETA_REPORTS.length", "STEPS.length"]) {
    assert.ok(page.includes(name), `${name} absent de la landing`);
  }
});

test("le coach n'est pas présenté comme demandant une validation : il applique et annonce", () => {
  const coachTexts = page + code("components/landing/hero-visual.tsx");
  assert.doesNotMatch(coachTexts, /Tu valides|sans ton accord|Oui, ajoute|Je l&apos;ajoute/);
  assert.match(page, /annoncée et surlignée/);
});

test("pas de « modèles ATS » : seuls Minimaliste et Finance sont présentés comme tels", () => {
  assert.doesNotMatch(page, /modèles ATS/);
});

test("démo et visuels marqués « Exemple fictif »", () => {
  for (const path of ["components/landing/demo-dashboard.tsx", "components/landing/hero-visual.tsx", "app/page.tsx"]) {
    assert.match(code(path), /Exemple fictif/, path);
  }
});

test("la démo ne compte pas dans le plan des titres de la page", () => {
  assert.doesNotMatch(code("components/landing/demo-dashboard.tsx"), /<h[1-6][\s>]/);
});

test("sans JavaScript : blocs visibles par défaut, bouton fixe masqué", () => {
  const reveal = code("components/landing/reveal.tsx");
  assert.doesNotMatch(reveal, /(?<!data-\[reveal=hidden\]:)opacity-0/);
  assert.match(reveal, /prefers-reduced-motion/);
  assert.match(code("components/landing/mobile-cta-bar.tsx"), /useState\(false\)/);
});

test("offre bêta conditionnée à sa date de fin, page régénérée chaque jour", () => {
  assert.match(page, /isBetaOfferOpen\(new Date\(\)\)/);
  assert.match(page, /export const revalidate = /);
});

test("comparatif Huntr : prix de départ et mensuel, rien d'affirmé sans source", () => {
  assert.match(page, /Pro : dès /);
  assert.match(page, /en mensuel · dollars US/);
  assert.match(page, /"Interface en français", values: \["yes", "unknown"/);
  assert.match(page, /"Recherche d'offres intégrée", values: \["yes", "unknown"/);
  assert.match(page, /"Rappels de relance", values: \["yes", "unknown"/);
  assert.doesNotMatch(page, /très cher/);
});

test("ancres de l'en-tête présentes sur la landing", () => {
  const header = code("components/site/site-header.tsx");
  for (const id of ["fonctionnalites", "comment-ca-marche", "tarifs"]) {
    assert.ok(header.includes(`/#${id}`), id);
    assert.ok(page.includes(`id="${id}"`), id);
  }
});
