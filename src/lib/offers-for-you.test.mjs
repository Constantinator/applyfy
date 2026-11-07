// « Offres pour toi » du tableau de bord. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { offerImportHref, pickOffersForYou } = await import("./offers-for-you.ts");
const { titleKeywords, titleTerms } = await import("./offer-title.ts");

const NOW = new Date("2026-11-06T12:00:00Z");
let nextId = 0;
const row = (title, fields = {}) => {
  const id = `o${nextId++}`;
  return { id, title, company: `Société ${id}`, url: `https://exemple.fr/${id}`, scraped_at: "2026-11-01T10:00:00Z", last_seen_at: "2026-11-01T10:00:00Z", ...fields };
};
const pick = (rows, target = "Analyste financier", applied = []) => pickOffersForYou(rows, target, applied, NOW);

test("3 offres au plus, les plus proches du poste visé d'abord", () => {
  const offers = pick([
    row("Analyste crédit"),
    row("Analyste financier senior"),
    row("Comptable"),
    row("Analyste risques"),
    row("Analyste financier (H/F)"),
  ]);
  assert.equal(offers.length, 3);
  assert.match(offers[0].title, /Analyste financier/);
  assert.match(offers[1].title, /Analyste financier/);
  assert.ok(!offers.some((offer) => offer.title === "Comptable"));
});

test("à pertinence égale, la plus récente", () => {
  const offers = pick([
    row("Analyste A", { scraped_at: "2026-10-20T10:00:00Z" }),
    row("Analyste B", { scraped_at: "2026-11-05T10:00:00Z" }),
    row("Analyste C", { scraped_at: "2026-11-01T10:00:00Z", last_seen_at: "2026-11-01T10:00:00Z" }),
  ]);
  assert.deepEqual(offers.map((offer) => offer.title), ["Analyste B", "Analyste C", "Analyste A"]);
});

test("moins de 3 offres pertinentes : aucune", () => {
  assert.deepEqual(pick([row("Analyste A"), row("Analyste B"), row("Comptable")]), []);
  assert.deepEqual(pick([]), []);
});

test("sans poste visé : aucune", () => {
  assert.deepEqual(pick([row("Analyste A"), row("Analyste B"), row("Analyste C")], "  "), []);
});

test("offre non revue depuis plus de 21 jours : plus proposée", () => {
  const rows = [row("Analyste A"), row("Analyste B"), row("Analyste C", { last_seen_at: "2026-10-16T11:59:00Z" })];
  assert.deepEqual(pick(rows), []);
  rows[2].last_seen_at = "2026-10-16T12:00:00Z";
  assert.equal(pick(rows).length, 3);
});

test("offre ancienne mais revue récemment : toujours proposée", () => {
  const rows = ["A", "B", "C"].map((name) => row(`Analyste ${name}`, { scraped_at: "2026-08-01T10:00:00Z", last_seen_at: "2026-11-05T10:00:00Z" }));
  assert.equal(pick(rows).length, 3);
});

test("après la migration, last_seen_at égal à scraped_at : les offres récentes restent proposées", () => {
  const collected = "2026-10-27T03:57:00+00:00";
  const rows = ["A", "B", "C"].map((name) => row(`Analyste ${name}`, { scraped_at: collected, last_seen_at: collected }));
  assert.equal(pick(rows).length, 3);
});

test("sans entreprise ou sans lien valide : écartée", () => {
  const good = [row("Analyste A"), row("Analyste B")];
  assert.deepEqual(pick([...good, row("Analyste C", { company: null })]), []);
  assert.deepEqual(pick([...good, row("Analyste C", { company: "  " })]), []);
  assert.deepEqual(pick([...good, row("Analyste C", { url: null })]), []);
  assert.deepEqual(pick([...good, row("Analyste C", { url: "javascript:alert(1)" })]), []);
});

test("déjà dans les candidatures ou en double : écartée", () => {
  const rows = [row("Analyste A"), row("Analyste B"), row("Analyste C", { company: "Acme", url: "https://acme.fr/1" })];
  assert.deepEqual(pick(rows, "Analyste", [{ company: "X", position: "Y", offer_url: "https://acme.fr/1" }]), []);
  assert.deepEqual(pick(rows, "Analyste", [{ company: "ACME", position: "Analyste C", offer_url: null }]), []);
  const duplicate = [row("Analyste A", { company: "Acme" }), row("analyste a", { company: "acme" }), row("Analyste B")];
  assert.deepEqual(pick(duplicate, "Analyste"), []);
});

test("métier composé : d'un seul tenant, mot entier", () => {
  const rows = [row("Product Manager"), row("Senior Product Manager"), row("Product Manager Paiement"), row("Office Manager"), row("Reproduct")];
  const offers = pick(rows, "Product Manager");
  assert.equal(offers.length, 3);
  assert.ok(offers.every((offer) => /Product Manager/.test(offer.title)));
  assert.deepEqual(pick([row("Analystes"), row("Psychanalyste"), row("Analyste")], "Analyste"), []);
});

test("accents ignorés dans la comparaison", () => {
  assert.equal(pick([row("Développeur web"), row("DEVELOPPEUR API"), row("Developpeur mobile")], "Développeur").length, 3);
});

test("lien vers la fiche d'import : encodé", () => {
  assert.equal(
    offerImportHref("https://exemple.fr/o?id=1&a=b"),
    "/candidatures/nouvelle?lien=https%3A%2F%2Fexemple.fr%2Fo%3Fid%3D1%26a%3Db",
  );
});

test("mots-clés d'un intitulé : comportement de la recherche recommandée inchangé", () => {
  assert.equal(titleKeywords("Marketing Manager"), "marketing");
  assert.equal(titleKeywords("Data Analyst – Équipe Paiement"), "data analyst");
  assert.equal(titleKeywords("Stage - Chargé de marketing digital (H/F)"), "marketing digital");
  assert.equal(titleKeywords("Community Manager"), "community manager");
  assert.equal(titleKeywords("Responsable"), "responsable");
  assert.deepEqual(titleTerms("Chargée de recrutement"), ["recrutement"]);
});
