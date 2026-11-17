// Lot score (S4) : pivot d'un CV libre. Le titre du CV qui désigne un métier reconnu fixe le
// secteur du score, même si le poste visé à l'import et les expériences sont d'un autre métier ;
// les 12 profils du banc gardent leur secteur. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { chatContent, CvDataSchema, targetJobOf } = await import("./cv-builder-types.ts");
const { cvScoringSector, detectSector } = await import("./cv-sector-context.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");

const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);
const profiles = ["dev", "holdout"].flatMap((set) =>
  readdirSync(new URL(`profiles/${set}/`, FIXTURES))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(`profiles/${set}/${f}`, FIXTURES), "utf8"))),
);
const sectorOf = (cv) => detectSector(JSON.stringify(chatContent(cv)), targetJobOf(cv));
const retitled = (cv, jobTitle) => ({ ...cv, personal: { ...cv.personal, jobTitle } });

test("les 12 profils du banc gardent leur secteur", () => {
  for (const p of profiles) assert.equal(sectorOf(CvDataSchema.parse(p.cv)), p.sector, p.id);
});

test("pivot : le titre changé fixe le secteur, poste visé et expériences d'un autre métier", () => {
  const PIVOTS = [
    ["tech", "Développeur backend"],
    ["finance", "Analyste financier"],
    ["conseil", "Consultant junior"],
    ["marketing", "Chargé de marketing digital"],
    ["creatif", "Graphiste"],
    ["rh", "Chargé de recrutement"],
    ["sante", "Infirmier"],
    ["luxe", "Conseiller de vente en boutique de luxe"],
  ];
  for (const p of profiles) {
    const cv = CvDataSchema.parse(p.cv);
    for (const [sector, title] of PIVOTS) {
      if (sector === p.sector) continue;
      assert.equal(sectorOf(retitled(cv, title)), sector, `${p.id} → « ${title} »`);
    }
  }
  // Le score suit : mots-clés du nouveau secteur, et non plus ceux de l'ancien.
  const commercial = CvDataSchema.parse(profiles.find((p) => p.id === "commercial-junior-fr").cv);
  assert.equal(scoringContextFrom(retitled(commercial, "Développeur backend"), null, []).sector, "tech");
});

test("pas de pivot : titre vide, d'étudiant ou ambigu → règle d'avant (poste visé et expériences)", () => {
  const finance = CvDataSchema.parse(profiles.find((p) => p.id === "finance-junior-fr").cv);
  assert.equal(sectorOf(retitled(finance, "")), "finance");
  assert.equal(sectorOf(retitled(finance, "Étudiant en master")), "finance", "étudiant : le métier des expériences l'emporte");
  assert.equal(sectorOf(retitled(finance, "Polyvalent motivé")), "finance", "titre sans métier reconnu");
});

test("CV lié : le secteur de l'offre l'emporte toujours sur le titre", () => {
  const commercial = CvDataSchema.parse(profiles.find((p) => p.id === "commercial-junior-fr").cv);
  const cv = retitled(commercial, "Développeur backend");
  const offer = { position: "Commercial B2B", company: "X", description: null, sector: "commercial" };
  assert.equal(cvScoringSector(JSON.stringify(chatContent(cv)), targetJobOf(cv), offer), "commercial");
});
