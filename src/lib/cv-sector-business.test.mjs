// Lot score (S4b) : « Business developer » et « développeur d'affaires » sont des postes
// commerciaux, pas de développeur (tech) ; un vrai poste de développeur reste tech. Vaut pour le
// secteur d'une offre (detectOfferSector) et pour le pivot d'un CV libre (detectSector).
import assert from "node:assert/strict";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { detectOfferSector, detectSector } = await import("./cv-sector-context.ts");

test("postes commerciaux malgré « developer » / « développeur »", () => {
  for (const title of ["Business developer", "Business Developer junior", "Business Development Manager", "Développeur d'affaires", "Développeur commercial H/F"]) {
    assert.equal(detectOfferSector(title), "commercial", title);
  }
});

test("vrais postes de développeur : toujours tech", () => {
  for (const title of ["Software Developer", "Développeur backend", "Développeur full stack", "Front-end developer", "Développeur Java senior"]) {
    assert.equal(detectOfferSector(title), "tech", title);
  }
});

test("pivot d'un CV libre vers « Business developer » : commercial", () => {
  const cv = { personal: { jobTitle: "Business developer" }, experiences: [{ position: "Analyste financier", company: "Banque" }] };
  assert.equal(detectSector(JSON.stringify(cv), "Analyste financier"), "commercial");
});
