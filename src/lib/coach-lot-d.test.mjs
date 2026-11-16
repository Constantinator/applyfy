// Lot D du coach (runs 2026-11-16T02-55-59 et 2026-11-16T03-20-31) : poste visé d'un CV lié,
// question de suite « sans chiffre », réponse « prêt ? », puce sans chiffre après une question qui
// n'en demandait pas, niveau gonflé. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, profile } from "./coach-test-fixtures.mjs";

const { coachSystem } = await import("./coach-prompt.ts");

// --- 1. CV lié : l'offre fixe le poste visé ---

test("CV lié : ni « Poste visé » du CV d'origine ni « Postes suggérés » dans le prompt (O04)", () => {
  const cv = profile("tech-stage-fr");
  const analysis = { ...(cv.analysis ?? {}), targetJob: "Stage développeur web", suggestedJobs: ["Développeur front-end junior"] };
  const linked = coachSystem({ ...contextFor(cv, detailOf("o-finance-analyste")), analysis: { criteria: {}, improvements: [], optimizations: [], ...analysis } }, "");
  assert.ok(linked.includes("Intitulé du poste : Analyste financier"));
  assert.ok(!linked.includes("Poste visé :"));
  assert.ok(!linked.includes("Postes suggérés :"));
  assert.ok(!linked.includes("Stage développeur web"));
});

test("CV libre : « Poste visé » et « Postes suggérés » restent dans le bloc <analyse>", () => {
  const cv = profile("tech-stage-fr");
  const free = coachSystem(
    { ...contextFor(cv, null), analysis: { criteria: {}, improvements: [], optimizations: [], targetJob: "Stage développeur web", suggestedJobs: ["Développeur front-end junior"] } },
    "",
  );
  assert.ok(free.includes("Poste visé : Stage développeur web"));
  assert.ok(free.includes("Postes suggérés : Développeur front-end junior"));
});
