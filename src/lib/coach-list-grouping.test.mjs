// Dernier lot du coach (C7) : regrouper, réorganiser, trier, ordonner ou classer n'est jamais une
// demande de suppression. Une liste réécrite est comparée élément par élément, une fois aplatie
// (« Hard skills : a, b » donne a, b) : un élément perdu sans demande ni accord est refusé, qu'il y
// ait eu un regroupement ou non. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { asksToRemove, proposesRemoval } = await import("./coach-intent.ts");
const { droppedListItems, flattenListItems, PROBLEM_REMOVAL_NOT_ASKED } = await import("./coach-proposals.ts");

const base = profile("finance-junior-fr");
const cv = { ...base, skills: ["Excel", "Word", "Analyse financière", "Travail en équipe"].map((name, i) => ({ id: `s${i}`, name, level: "" })) };
const skills = (names) => ({ section: "skills", data: JSON.stringify(names.map((name) => ({ name, level: "" }))) });
const demande = (updates) => flat({ mode: "demande", change_summary: "C'est fait.", updates });
const history = [{ role: "assistant", content: "Combien de clients suivais-tu ?" }];
const play = (request, reply) => turn(cv, contextFor(cv, null, { history, request }), history, request, reply);
const problemsOf = (result) => result.problems.flatMap((p) => p.problems);
const GROUP = "Regroupe mes compétences en Hard skills / Soft skills.";

test("regrouper, réorganiser, trier, ordonner, classer : jamais une demande de suppression", () => {
  for (const m of [
    GROUP,
    "Réorganise mes compétences par thème.",
    "Trie mes compétences par ordre d'importance.",
    "Ordonne mes langues par niveau.",
    "Classe mes compétences en deux groupes.",
    "Group my skills into two categories.",
    "Reorganize my skills please.",
    "Sort my skills by relevance.",
    "Order my languages by level.",
  ]) {
    assert.equal(asksToRemove(m), false, m);
  }
  assert.equal(proposesRemoval("Veux-tu que je regroupe tes compétences en deux catégories ?"), false);
  // Les demandes de suppression restent reconnues.
  assert.ok(asksToRemove("Retire « Travail en équipe » de mes compétences."));
  assert.ok(asksToRemove("Fusionne ces deux puces."));
});

test("liste aplatie : catégories retirées, éléments séparés", () => {
  const items = (names) => names.map((name, i) => ({ id: `i${i}`, name, level: "" }));
  assert.deepEqual(flattenListItems(items(["Hard skills : Excel, Word", "Soft skills : Travail en équipe", "Python"])), ["Excel", "Word", "Travail en équipe", "Python"]);
  const before = items(["Excel", "Word", "Analyse financière"]);
  assert.deepEqual(droppedListItems(before, items(["Hard skills : Excel, Analyse financière"])), ["Word"]);
  assert.deepEqual(droppedListItems(before, items(["Excel, Word", "Analyse financière"])), [], "Excel + Word → « Excel, Word »");
  assert.deepEqual(droppedListItems(before, items(["Excel avancé", "Word", "Analyse financière"])), [], "Excel → Excel avancé");
});

test("(a) regroupement qui garde tous les éléments : accepté", async () => {
  const result = await play(GROUP, demande([skills(["Hard skills : Excel, Word, Analyse financière", "Soft skills : Travail en équipe"])]));
  assert.equal(result.applied, 1);
  assert.ok(!problemsOf(result).includes(PROBLEM_REMOVAL_NOT_ASKED));
});

test("(b) même regroupement qui perd une compétence : refusé, message d'échec habituel", async () => {
  const result = await play(GROUP, demande([skills(["Hard skills : Excel, Word, Analyse financière"])]));
  assert.equal(result.applied, 0);
  assert.ok(problemsOf(result).includes(PROBLEM_REMOVAL_NOT_ASKED));
  assert.match(result.text, /je ne supprime un passage que si tu me le demandes/);
  assert.deepEqual(result.updated.skills.map((s) => s.name), ["Excel", "Word", "Analyse financière", "Travail en équipe"]);
});

test("(c) « Retire « Travail en équipe » de mes compétences » : accepté", async () => {
  const result = await play("Retire « Travail en équipe » de mes compétences.", demande([skills(["Excel", "Word", "Analyse financière"])]));
  assert.equal(result.applied, 1);
  assert.deepEqual(result.updated.skills.map((s) => s.name), ["Excel", "Word", "Analyse financière"]);
});

test("(d) regroupement qui fusionne deux éléments en un : accepté ; qui en perd un : refusé", async () => {
  const merged = await play(GROUP, demande([skills(["Bureautique : Excel, Word", "Analyse financière", "Travail en équipe"])]));
  assert.equal(merged.applied, 1);
  const lost = await play(GROUP, demande([skills(["Bureautique : Excel", "Analyse financière", "Travail en équipe"])]));
  assert.equal(lost.applied, 0);
  assert.ok(problemsOf(lost).includes(PROBLEM_REMOVAL_NOT_ASKED));
});
