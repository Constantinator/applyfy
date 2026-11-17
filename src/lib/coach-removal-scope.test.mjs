// Dernier lot du coach (C3) : un accord à une proposition de suppression ne vaut que pour le
// passage proposé ; un élément retiré d'une liste (compétences, langues…) est une suppression.
// Regroupement, renommage, réordonnancement et traduction ne suppriment rien. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { removalScope } = await import("./coach-intent.ts");
const { droppedListItems, PROBLEM_REMOVAL_NOT_ASKED, PROBLEM_REMOVAL_OUT_OF_SCOPE } = await import("./coach-proposals.ts");

const cv = profile("finance-junior-fr");
const coach = (content) => [{ role: "assistant", content }];
const PROPOSAL = "Ta puce « Préparation des comités de crédit » fait doublon avec celle sur tes dossiers. Veux-tu que je la supprime ?";
const removeBullets = (indexes) => ({ section: "experience", data: JSON.stringify({ id: "fj-e1", bullets: [], bullets_to_remove: indexes }) });
const skills = (names) => ({ section: "skills", data: JSON.stringify(names.map((name) => ({ name, level: "" }))) });
const demande = (updates) => flat({ mode: "demande", change_summary: "C'est fait.", updates });
const play = (history, request, reply) => turn(cv, contextFor(cv, null, { history, request }), history, request, reply);
const problemsOf = (result) => result.problems.flatMap((p) => p.problems);

test("portée : passages cités par la proposition (question ou phrase juste avant)", () => {
  assert.deepEqual(removalScope(coach(PROPOSAL), "oui"), ["Préparation des comités de crédit"]);
  assert.deepEqual(removalScope(coach("Veux-tu que je supprime la puce « Suivi du portefeuille clients » ?"), "Oui, vas-y"), ["Suivi du portefeuille clients"]);
  assert.deepEqual(removalScope(coach("Veux-tu que je supprime ta dernière puce ?"), "oui"), [], "rien de cité : une seule suppression");
});

test("pas de portée : suppression demandée par le candidat, refus, autre question", () => {
  assert.equal(removalScope(coach(PROPOSAL), "Supprime aussi la puce sur le portefeuille clients"), null, "demande explicite : pas de limite");
  assert.equal(removalScope(coach(PROPOSAL), "non, garde-la"), null);
  assert.equal(removalScope(coach("Combien de clients suivais-tu ?"), "oui"), null);
});

test("accord : seul le passage proposé est supprimé, l'autre suppression est refusée", async () => {
  const result = await play(coach(PROPOSAL), "oui", demande([removeBullets([1, 2])]));
  assert.deepEqual(result.updated.experiences[0].bullets, ["Analyse des dossiers de crédit des PME", "Suivi du portefeuille clients"]);
  assert.ok(problemsOf(result).includes(PROBLEM_REMOVAL_OUT_OF_SCOPE));
});

test("accord sans passage cité : une seule suppression", async () => {
  const result = await play(coach("Ces deux puces se recoupent. Veux-tu que je supprime la moins précise ?"), "oui", demande([removeBullets([1, 2])]));
  assert.equal(result.updated.experiences[0].bullets.length, 2);
  assert.ok(problemsOf(result).includes(PROBLEM_REMOVAL_OUT_OF_SCOPE));
});

test("suppression demandée par le candidat : pas de limite au passage proposé", async () => {
  const result = await play(coach(PROPOSAL), "Supprime les puces sur les comités et sur le portefeuille clients.", demande([removeBullets([1, 2])]));
  assert.deepEqual(result.updated.experiences[0].bullets, ["Analyse des dossiers de crédit des PME"]);
});

test("éléments de liste retirés : détectés ; regroupement, renommage, réordonnancement : rien de retiré", () => {
  const items = (names) => names.map((name, i) => ({ id: `s${i}`, name, level: "" }));
  const before = items(["Excel", "Analyse financière", "Travail en équipe"]);
  assert.deepEqual(droppedListItems(before, items(["Excel", "SQL"])), ["Analyse financière", "Travail en équipe"]);
  assert.deepEqual(droppedListItems(before, items(["Hard skills : Excel, Analyse financière", "Soft skills : Travail en équipe"])), [], "regroupement");
  assert.deepEqual(droppedListItems(before, items(["Excel avancé", "Analyse financière", "Travail en équipe"])), [], "Excel → Excel avancé");
  assert.deepEqual(droppedListItems(before, items(["Travail en équipe", "Excel", "Analyse financière"])), [], "réordonnancement");
});

test("liste : élément retiré sans demande refusé ; demande explicite, regroupement et traduction acceptés", async () => {
  const added = await play(coach("Combien de clients ?"), "Ajoute SQL à mes compétences.", demande([skills(["Excel", "SQL"])]));
  assert.ok(problemsOf(added).includes(PROBLEM_REMOVAL_NOT_ASKED));
  assert.deepEqual(added.updated.skills.map((s) => s.name), ["Excel", "Analyse financière", "Travail en équipe"]);

  const asked = await play(coach("Combien de clients ?"), "Retire « Travail en équipe » de mes compétences.", demande([skills(["Excel", "Analyse financière"])]));
  assert.deepEqual(asked.updated.skills.map((s) => s.name), ["Excel", "Analyse financière"]);

  const grouped = await play(coach("Combien de clients ?"), "Regroupe mes compétences en deux catégories.", demande([skills(["Hard skills : Excel, Analyse financière", "Soft skills : Travail en équipe"])]));
  assert.ok(!problemsOf(grouped).some((p) => p === PROBLEM_REMOVAL_NOT_ASKED || p === PROBLEM_REMOVAL_OUT_OF_SCOPE));
  assert.equal(grouped.applied, 1);

  const translated = await play(coach("Combien de clients ?"), "Traduis mes compétences en anglais.", demande([skills(["Excel", "Financial analysis", "Teamwork"])]));
  assert.ok(!problemsOf(translated).includes(PROBLEM_REMOVAL_NOT_ASKED));
  assert.equal(translated.applied, 1);
});
