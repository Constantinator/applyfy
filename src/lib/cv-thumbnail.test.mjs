// Lot sélecteur, vignettes : le vrai CV réduit à la page 1, clé stable, repli en barres grises, délai
// de 400 ms. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { PLACEHOLDER_MARK, THUMBNAIL_DELAY_MS, createThumbnailScheduler, isNearlyEmpty, thumbnailData, thumbnailKey } = await import(
  "./cv-thumbnail.ts"
);

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,(){}])\/\/.*$/gm, "$1");

const PHOTO = `data:image/jpeg;base64,/9j/${"A".repeat(4000)}`;
const longCv = () =>
  CvDataSchema.parse({
    personal: { firstName: "Inès", lastName: "Roux", jobTitle: "Contrôleuse de gestion", email: "ines@exemple.fr", photo: PHOTO },
    summary: "Résumé. ".repeat(60),
    experiences: Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`,
      position: `Poste ${i}`,
      company: `Entreprise ${i}`,
      startDate: "2020",
      bullets: Array.from({ length: 8 }, (_, j) => `Puce ${i}.${j} `.repeat(10)),
    })),
    education: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, school: `École ${i}`, degree: `Diplôme ${i}` })),
    skills: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, name: `Compétence ${i}` })),
    languages: Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, name: `Langue ${i}`, level: "B2" })),
    certifications: Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Certif ${i}` })),
    projects: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Projet ${i}`, description: "Description. ".repeat(20) })),
    interests: "Course, lecture. ".repeat(25),
  });
const textOf = (data) => JSON.stringify(data);

test("CV réduit à la page 1 : le début de chaque rubrique, rien d'inventé, la photo gardée", () => {
  const cv = longCv();
  const t = thumbnailData(cv);
  assert.ok(t.experiences.length <= 4 && t.experiences.length >= 3);
  assert.deepEqual(t.experiences[0].bullets.slice(0, 2), cv.experiences[0].bullets.slice(0, 2));
  assert.ok(t.experiences.every((e) => e.bullets.length <= 4));
  assert.ok(t.education.length <= 3 && t.skills.length <= 12 && t.languages.length <= 5);
  assert.ok(t.certifications.length <= 4 && t.projects.length <= 2);
  assert.ok(t.summary.length <= 700 && t.interests.length <= 200);
  assert.equal(t.personal.firstName, "Inès");
  assert.equal(t.personal.photo, PHOTO, "photo du CV, rendue dans le navigateur");
  assert.ok(!textOf(t).includes(PLACEHOLDER_MARK), "CV rempli : aucune barre grise");
  // Ni analyse, ni coach, ni poste visé : rien qui ne soit pas dessiné.
  assert.equal(t.analysis, null);
  assert.equal(t.coach, null);
});

test("clé stable : même CV, même clé ; une modification hors page 1 ne la change pas", () => {
  const cv = longCv();
  const key = thumbnailKey(thumbnailData(cv), "fr");
  assert.equal(thumbnailKey(thumbnailData(longCv()), "fr"), key);
  // 9e expérience, 8e puce, 30e compétence : hors de la page 1.
  const hidden = structuredClone(cv);
  hidden.experiences[8].position = "Autre poste";
  hidden.experiences[0].bullets[7] = "Puce modifiée hors page 1";
  hidden.skills[29].name = "Autre compétence";
  hidden.targetJob = "Autre poste visé";
  assert.equal(thumbnailKey(thumbnailData(hidden), "fr"), key);
  // Visible : nom, première puce, accent, police, photo, langue.
  const visible = [
    (d) => (d.personal.firstName = "Inés"),
    (d) => (d.experiences[0].bullets[0] = "Nouvelle puce"),
    (d) => (d.style.accent = "#123456"),
    (d) => (d.style.typeface = "gelasio"),
    (d) => (d.personal.photo = `data:image/jpeg;base64,/9j/${"B".repeat(4000)}`),
  ];
  for (const change of visible) {
    const d = structuredClone(cv);
    change(d);
    assert.notEqual(thumbnailKey(thumbnailData(d), "fr"), key, String(change));
  }
  assert.notEqual(thumbnailKey(thumbnailData(cv), "en"), key, "langue");
  // Clé courte : la photo n'y est pas recopiée.
  assert.ok(key.length < 20_000 && !key.includes("A".repeat(100)));
});

test("CV presque vide : barres grises neutres, aucun texte ni personne inventés", () => {
  const empty = CvDataSchema.parse({});
  assert.ok(isNearlyEmpty(empty));
  const t = thumbnailData(empty);
  // Toutes les chaînes non vides sont des barres (marque + lettres neutres), aucun mot.
  const strings = [];
  // Réglages de mise en page (police, densité…) exclus : ce ne sont pas des textes du CV.
  JSON.stringify(t, (k, v) => (k === "style" ? undefined : typeof v === "string" && v && !["id", "level"].includes(k) ? (strings.push(v), v) : v));
  assert.ok(strings.length >= 8, "page remplie de barres");
  for (const s of strings) assert.match(s, new RegExp(`^(${PLACEHOLDER_MARK}x+ ?)+$`), s);
  assert.equal(t.personal.email, "");
  assert.equal(t.personal.photo, null);

  // Nom et poste connus : gardés tels quels, le reste en barres.
  const named = CvDataSchema.parse({ personal: { firstName: "Léa", lastName: "Morel", jobTitle: "Juriste" } });
  assert.ok(isNearlyEmpty(named));
  const n = thumbnailData(named);
  assert.equal(n.personal.firstName, "Léa");
  assert.equal(n.personal.jobTitle, "Juriste");
  assert.ok(n.experiences.length > 0 && n.experiences[0].position.startsWith(PLACEHOLDER_MARK));

  // Une rubrique remplie sur deux : les rubriques vides passent en barres, la rubrique remplie reste réelle.
  const one = CvDataSchema.parse({ experiences: [{ id: "a", position: "Stagiaire", company: "Acme", bullets: ["Une vraie puce"] }] });
  assert.ok(isNearlyEmpty(one));
  assert.equal(thumbnailData(one).experiences[0].position, "Stagiaire");
  assert.ok(thumbnailData(one).summary.startsWith(PLACEHOLDER_MARK));

  // Deux rubriques remplies : le CV réel, sans barre.
  const two = CvDataSchema.parse({ summary: "Un vrai résumé.", skills: [{ id: "s", name: "Excel" }] });
  assert.ok(!isNearlyEmpty(two));
  assert.ok(!textOf(thumbnailData(two)).includes(PLACEHOLDER_MARK));
});

test("délai de 400 ms (minuteurs simulés) : 10 frappes rapides = 1 rendu, hors page 1 = 0 rendu", () => {
  assert.equal(THUMBNAIL_DELAY_MS, 400);
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const renders = [];
    const scheduler = createThumbnailScheduler("k0", (value) => renders.push(value));
    for (let i = 1; i <= 10; i++) {
      scheduler.push(`k${i}`, `v${i}`);
      mock.timers.tick(100);
    }
    assert.equal(renders.length, 0, "pas de rendu pendant la frappe");
    mock.timers.tick(400);
    assert.deepEqual(renders, ["v10"], "un seul rendu, avec la dernière valeur");

    // Modification hors page 1 : même clé que la valeur affichée, aucun rendu.
    scheduler.push("k10", "v10 bis");
    mock.timers.tick(1000);
    assert.equal(renders.length, 1);

    // Modification annulée avant le délai (retour à la clé affichée) : aucun rendu.
    scheduler.push("k11", "v11");
    mock.timers.tick(200);
    scheduler.push("k10", "v10");
    mock.timers.tick(1000);
    assert.equal(renders.length, 1);

    // Démontage : le minuteur en cours est annulé.
    scheduler.push("k12", "v12");
    scheduler.dispose();
    mock.timers.tick(1000);
    assert.equal(renders.length, 1);
  } finally {
    mock.timers.reset();
  }
});

test("vignettes : mémoïsées, données différées par le planificateur, langue transmise, plus de CV fictif", () => {
  const preview = code("components/cv-builder/cv-html-preview.tsx");
  assert.match(preview, /export const CvThumbnail = memo\(/);
  assert.match(preview, /<CvPages data=\{data\} templateId=\{templateId\} language=\{language\} \/>/);
  const hook = code("components/cv-builder/use-thumbnail-data.ts");
  assert.match(hook, /createThumbnailScheduler(<\w+>)?\(/);
  assert.doesNotMatch(hook, /useDeferredValue/);
  const panel = code("components/cv-builder/cv-style-panel.tsx");
  assert.match(panel, /useThumbnailData\(data, language\)/);
  for (const path of ["components/cv-builder/cv-style-panel.tsx", "components/cv-builder/new-cv-dialog.tsx"]) {
    assert.doesNotMatch(read(path), /Sophie|Martin|Camille|Durand|SAMPLE/, path);
  }
  // Onglet Style : les vignettes ne sont montées que quand l'onglet est ouvert.
  assert.match(code("components/cv-builder/cv-builder-editor.tsx"), /\{tab === "style" && \(/);
});

test("barres grises : rendues seulement dans l'aperçu HTML, jamais dans le PDF", () => {
  assert.match(code("components/cv-builder/cv-html-preview.tsx"), /PLACEHOLDER_MARK/);
  assert.doesNotMatch(code("components/cv-builder/cv-document.tsx"), /PLACEHOLDER_MARK|cv-thumbnail/);
});
