// Lot « consignes du coach » (run 2026-11-16T00-45-04) : chaque correction rejoue les messages
// réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");
const { coachSystem } = await import("./coach-prompt.ts");

// --- 1. CV clos : la réponse à une question ouverte est gardée, sans question ---

const conseil = profile("conseil-confirme-fr");
const manager = detailOf("o-conseil-manager");

/** O05, échange 2 : un fait (30 ateliers) et une question ouverte, sur un CV clos à 85. */
const O05_HISTORY = [
  { role: "assistant", content: "Ton CV est prêt : il atteint 85/100 (seuil de 80). Je n'ai plus de question à te poser." },
  { role: "user", content: "Tu vois autre chose à changer pour cette offre ?" },
  { role: "assistant", content: "Le plus utile serait de chiffrer tes puces chez Cabinet Exemple Stratégie." },
];
const O05_REQUEST =
  "Merci pour les pistes. Pour l'atelier de cadrage, je peux dire que j'ai animé plus de 30 ateliers de cadrage avec des directions générales. Pour les diagnostics chez Cabinet Exemple Stratégie et les recommandations, je ne dispose pas de chiffres précis, donc je ne peux pas inventer de résultats. Est-ce que tu peux me dire comment les formuler sans chiffres inventés ? Sinon, je pense que ça me va pour l'instant.";
const O05_ANSWER =
  "Sans chiffre, précise plutôt le périmètre : le type de clients (ETI de la distribution) et à qui tu présentais tes recommandations (comités exécutifs), c'est déjà concret.";
const ateliers = (message) =>
  flat({
    section: "experience",
    change_summary: "C'est fait : j'ai précisé ta puce sur les ateliers de cadrage.",
    message,
    data: JSON.stringify({ id: "cc-e1", bullets: [{ index: 2, after: "Animation de plus de 30 ateliers de cadrage avec des directions générales" }] }),
  });

test("question ouverte : détectée seulement pour une vraie question ouverte", () => {
  assert.equal(intent.listeningState(O05_HISTORY, O05_REQUEST).openQuestion, true);
  for (const message of ["Tu me conseilles de les mettre dans l'accroche ?", "Qu'en penses-tu ?", "Est-ce qu'il vaut mieux garder cette puce ?", "How should I phrase it?", "Which one is better?"]) {
    assert.equal(intent.listeningState([], message).openQuestion, true, message);
  }
});

test("question ouverte : non-déclenchement (prêt ?, que reste-t-il ?, confirmation, aide générale, sans « ? »)", () => {
  for (const message of [
    "Est-ce que mon CV est prêt ?",
    "Tu vois autre chose à changer pour cette offre ?",
    "Peux-tu confirmer que la puce est ajoutée ?",
    "Can you help me improve my CV please?",
    "Merci",
    "Je ne sais pas comment le dire, je préfère laisser comme ça.",
    "Aide-moi à améliorer mon CV.",
  ]) {
    assert.ok(!("openQuestion" in intent.listeningState([], message)), message);
  }
});

test("O05 rejoué : sur un CV clos, l'annonce, la réponse du modèle et le score sont affichés", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers(O05_ANSWER));
  assert.ok(result.text.startsWith("C'est fait : « Animation de plus de 30 ateliers de cadrage"), result.text);
  assert.ok(result.text.includes(O05_ANSWER), result.text);
  assert.ok(/Ton CV est (prêt : il atteint|à) \d+\/100/.test(result.text), result.text);
  assert.ok(!result.text.includes("?"), result.text);
});

/** Contexte d'O05 avec le score du run (85, CV clos). */
const closedContext = (request) => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request });
  return { ...context, score: { ...context.score, value: 85 } };
};

test("O05 rejoué : le prompt demande de répondre à la question, sans question, sur un CV clos", () => {
  const context = closedContext(O05_REQUEST);
  assert.ok(coachSystem(context, "").includes("Le candidat te pose une question : réponds-y dans « message »"));
});

test("CV clos, question ouverte : un message du modèle avec « ? » reste retiré", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers("Tu peux préciser le type de clients. Veux-tu que je le fasse ?"));
  assert.ok(!result.text.includes("?"), result.text);
  assert.ok(!result.text.includes("Tu peux préciser le type de clients"), result.text);
});

test("CV clos, question ouverte : « Dis-moi si tu veux une modification précise » n'est pas reprise", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers("Dis-moi si tu veux une modification précise."));
  assert.ok(!result.text.includes("Dis-moi si"), result.text);
});

test("CV clos, « Merci » seul : texte inchangé (annonce et score)", async () => {
  const request = "Merci, j'ai animé plus de 30 ateliers de cadrage avec des directions générales.";
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request });
  assert.ok(!("openQuestion" in context.listening));
  assert.ok(!coachSystem(closedContext(request), "").includes("Le candidat te pose une question"));
  const result = await turn(conseil, context, O05_HISTORY, request, ateliers("Dis-moi si tu veux une modification précise."));
  // Texte de main : annonce, puis clôture (ou score), sans le message du modèle.
  assert.match(result.text, /^C'est fait : « Animation de plus de 30 ateliers de cadrage avec des directions générales » — Consultant senior chez Cabinet Conseil Fictif \(puce 3\)\. Ton CV est (prêt : il atteint|à) \d+\/100/);
  assert.ok(!result.text.includes("Dis-moi si"), result.text);
});

test("CV pas encore clos, question ouverte : pas de consigne ajoutée, texte habituel", async () => {
  const cv = profile("tech-stage-fr");
  const request = "Tu me conseilles de mettre l'API dans l'accroche ?";
  const context = contextFor(cv, null, { history: [], request });
  assert.ok(!coachSystem(context, "").includes("Le candidat te pose une question"));
  const result = await turn(cv, context, [], request, flat({ message: "Oui, l'accroche est le bon endroit. Veux-tu que je l'y ajoute ?" }));
  assert.equal(result.text, "Oui, l'accroche est le bon endroit. Veux-tu que je l'y ajoute ?");
});
