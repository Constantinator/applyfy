// Dernier lot du coach (C5) : une question qui redemande un chiffre déjà donné par le candidat est
// retirée par le serveur (O01 : « 40 dossiers » puis « sur combien de dossiers… ? ») ; une question
// sur un autre chiffre du même nom (par mois, dont…, sur combien de temps) reste. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { asksGivenFigure, givenFigureNouns, listenText } = await import("./coach-intent.ts");

const given = (...messages) => givenFigureNouns(messages);

test("question retirée : même nom compté déjà donné (français, anglais)", () => {
  assert.ok(asksGivenFigure("Sur combien de dossiers environ réalises-tu l'analyse ?", given("Je prépare 40 dossiers de crédit par mois.")));
  assert.ok(asksGivenFigure("Combien de stagiaires as-tu formés ?", given("Je suivais 40 clients et j'ai formé 3 stagiaires.")));
  assert.ok(asksGivenFigure("How many clients do you manage?", given("I manage 40 clients.")));
});

test("question gardée : autre chiffre (par mois, dont, sur combien de temps), autre nom, rien de donné", () => {
  const clients = given("Je suivais 40 clients.");
  assert.ok(!asksGivenFigure("Combien de clients suivais-tu par mois ?", clients), "par mois");
  assert.ok(!asksGivenFigure("Combien de clients par an ?", clients), "par an");
  assert.ok(!asksGivenFigure("Combien de clients par semaine ?", clients), "par semaine");
  assert.ok(!asksGivenFigure("Combien de clients, dont combien de nouveaux ?", clients), "dont");
  assert.ok(!asksGivenFigure("Sur combien de temps as-tu suivi ces clients ?", clients), "sur combien de temps");
  assert.ok(!asksGivenFigure("Combien de comités prépares-tu ?", clients), "autre nom");
  assert.ok(!asksGivenFigure("Combien de clients suivais-tu ?", given("Je suivais des clients PME.")), "aucun nombre donné");
  assert.ok(!asksGivenFigure("Tu suivais 40 clients.", clients), "pas une question");
});

test("listenText : seule la question redondante est retirée, le reste du message est gardé", () => {
  const base = { mode: "parcours", lang: "fr", listening: { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false }, score: 60, scoreBefore: 60, corrections: [], previousCoach: [] };
  const candidateMessages = ["Je prépare 40 dossiers de crédit par mois."];
  assert.equal(
    listenText({ ...base, text: "C'est fait. Sur combien de dossiers environ réalises-tu l'analyse ?", candidateMessages }),
    "C'est fait.",
  );
  assert.equal(
    listenText({ ...base, text: "C'est fait. Combien de dossiers traites-tu par semaine ?", candidateMessages }),
    "C'est fait. Combien de dossiers traites-tu par semaine ?",
  );
});

test("échange complet : « combien de clients par mois ? » après « 40 clients » reste posée", async () => {
  const cv = profile("finance-junior-fr");
  const history = [{ role: "assistant", content: "Ta puce « Suivi du portefeuille clients » ne dit pas combien. Combien de clients suivais-tu ?" }];
  const request = "Je suivais 40 clients.";
  const kept = await turn(cv, contextFor(cv, null, { history, request }), history, request, flat({ message: "Combien de clients suivais-tu par mois ?" }));
  assert.match(kept.text, /Combien de clients suivais-tu par mois \?/);
  const dropped = await turn(cv, contextFor(cv, null, { history, request }), history, request, flat({ message: "Merci. Combien de clients suivais-tu ?" }));
  assert.doesNotMatch(dropped.text, /Combien de clients/);
});
