// Dernier lot du coach (C4) : reformulation demandée (O05 : « reformule ces deux puces sans
// chiffre »). Consigne du bloc situation, et contrôle du serveur : une reformulation qui ajoute au
// moins 2 mots de contenu absents du CV et des messages est refusée. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { asksToRephrase, listeningState } = await import("./coach-intent.ts");
const { newDetailWords, PROBLEM_NEW_DETAIL_PREFIX } = await import("./coach-proposals.ts");
const { coachSystem } = await import("./coach-prompt.ts");
const { actionWordDetector } = await import("./cv-score.ts");
const { COMMON_ACTION_VERBS } = await import("./cv-sector-context.ts");

const conseil = profile("conseil-confirme-fr");
const REQUEST = "Je n'ai pas de chiffres précis sur ces deux puces. Tu peux reformuler ces deux puces sans chiffre ?";
const O05_BULLET = "Réalisation de diagnostics stratégiques auprès d'ETI de la distribution, de l'analyse sectorielle à la formulation de recommandations";
const FAITHFUL = "Rédaction et présentation de recommandations stratégiques aux comités exécutifs";
const bullets = (list) => ({ section: "experience", data: JSON.stringify({ id: "cc-e2", bullets: list }) });
const demande = (updates) => flat({ mode: "demande", change_summary: "C'est fait.", updates });
const isAction = actionWordDetector(COMMON_ACTION_VERBS);

test("demande de reformulation : reconnue ; raccourcir, améliorer, ajouter n'en sont pas", () => {
  for (const m of [REQUEST, "Peux-tu réécrire cette puce ?", "Rephrase this bullet please", "Écris-la sans chiffre."]) assert.ok(asksToRephrase(m), m);
  for (const m of ["Raccourcis mon accroche.", "Aide-moi à améliorer mon CV.", "Ajoute une puce sur mes 12 contrats.", "Reformule et raccourcis mon accroche."]) {
    assert.ok(!asksToRephrase(m), m);
  }
  assert.equal(listeningState([], REQUEST).rephrase, true);
  assert.equal("rephrase" in listeningState([], "Aide-moi à améliorer mon CV."), false);
});

test("mots nouveaux : préfixe de 5 lettres, mots outils, verbe d'action en tête de proposition", () => {
  const sources = [JSON.stringify(conseil), REQUEST];
  assert.deepEqual(newDetailWords(O05_BULLET, sources, isAction), ["sectorielle", "formulation"]);
  assert.deepEqual(newDetailWords(FAITHFUL, sources, isAction), []);
  assert.deepEqual(newDetailWords("Gestion de la clientèle du portefeuille", ["Gérer les clients du portefeuille"], isAction), [], "gestion/gérer, clientèle/clients");
  assert.deepEqual(newDetailWords("Animation d'ateliers, conception d'outils", ["ateliers et outils"], isAction), [], "actions en tête de proposition");
});

test("O05 rejoué : la puce qui ajoute une méthode est refusée, la reformulation fidèle passe", async () => {
  const history = [{ role: "assistant", content: "Tes puces chez Cabinet Exemple Stratégie ne disent pas combien. Tu veux les retravailler ?" }];
  const result = await turn(conseil, contextFor(conseil, null, { history, request: REQUEST }), history, REQUEST, demande([bullets([{ index: 0, after: O05_BULLET }, { index: 2, after: FAITHFUL }])]));
  const problems = result.problems.flatMap((p) => p.problems);
  assert.ok(problems.some((p) => p.startsWith(PROBLEM_NEW_DETAIL_PREFIX) && p.includes("sectorielle")), problems.join("\n"));
  assert.equal(result.updated.experiences[1].bullets[2], FAITHFUL);
  assert.equal(result.updated.experiences[1].bullets[0], conseil.experiences[1].bullets[0]);
});

test("sans demande de reformulation : pas de contrôle « détail nouveau »", async () => {
  const history = [{ role: "assistant", content: "Comment s'est passée ta mission de diagnostic ?" }];
  const request = "Améliore ma puce sur les diagnostics.";
  const result = await turn(conseil, contextFor(conseil, null, { history, request }), history, request, demande([bullets([{ index: 0, after: O05_BULLET }])]));
  assert.ok(!result.problems.flatMap((p) => p.problems).some((p) => p.startsWith(PROBLEM_NEW_DETAIL_PREFIX)));
});

test("consigne du bloc situation, seulement pour une demande de reformulation", () => {
  assert.match(coachSystem(contextFor(conseil, null, { history: [], request: REQUEST }), ""), /Le candidat demande une reformulation/);
  assert.doesNotMatch(coachSystem(contextFor(conseil, null, { history: [], request: "Aide-moi" }), ""), /Le candidat demande une reformulation/);
});
