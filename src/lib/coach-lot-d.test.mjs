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

// --- 2. « Sans chiffre » n'est pas une question de chiffre ---

const intent = await import("./coach-intent.ts");

/** L14 (run 2026-11-16T03-20-31) : deux refus de chiffre de suite, puis une demande double. */
const L14_TWO_REFUSALS = [
  { role: "assistant", content: "Pour la puce « Suivi des indicateurs de performance » chez Marque Fictive, as-tu un résultat chiffré obtenu grâce à ce suivi (par exemple une hausse du taux de conversion ou du taux d'engagement, ou une baisse du coût d'acquisition) ?" },
  { role: "user", content: "Je ne dispose pas de chiffre précis sur l'impact de ce suivi, donc je préfère ne rien inventer." },
  { role: "assistant", content: "Pour l'événement de lancement, peux-tu me dire combien de personnes y ont participé et quel budget tu gérais ?" },
  { role: "user", content: "Je ne connais pas le nombre exact de participants ni le budget de cet événement, donc je ne veux pas avancer de chiffres." },
  { role: "assistant", content: "Souhaites-tu que je change le titre de ton CV en « Chef de projet événementiel » ?" },
];
const L14_DOUBLE_REQUEST =
  "Oui, je veux bien que tu changes le titre en « Chef de projet événementiel ». Tu peux reformuler la puce avec seulement ce que j'ai fait.";

const listen = (listening, text, extra = {}) =>
  intent.listenText({ text, mode: "demande", lang: "fr", listening, score: 74, scoreBefore: 72, corrections: [], previousCoach: [], ...extra });

test("deux refus de chiffre : la question de suite « …, sans chiffre ? » est gardée (L14, tour 6)", () => {
  const listening = intent.listeningState(L14_TWO_REFUSALS, L14_DOUBLE_REQUEST);
  assert.equal(listening.stopFigures, true);
  assert.deepEqual(listening.stopTypes, ["chiffre"]);
  const question = "Je reformule ensuite la puce « Organisation d'un événement de lancement » chez Agence Exemple : tu veux que je la reformule maintenant, sans chiffre ?";
  const shown = listen(listening, `C'est fait : j'ai remplacé le titre de ton CV par « Chef de projet événementiel ». ${question}`);
  assert.ok(shown.includes(question), shown);
  // Variantes : « sans aucun chiffre », anglais.
  assert.ok(listen(listening, "C'est fait. Je la reformule sans aucun chiffre ?").includes("sans aucun chiffre ?"));
  assert.ok(listen(listening, "Done. Shall I rewrite it without any figures?").includes("without any figures?"));
});

test("deux refus de chiffre : une vraie question de chiffre est toujours retirée", () => {
  const listening = intent.listeningState(L14_TWO_REFUSALS, L14_DOUBLE_REQUEST);
  const shown = listen(listening, "C'est fait : j'ai remplacé le titre. Combien d'invitations as-tu envoyées ?");
  assert.ok(!shown.includes("Combien"), shown);
  // « Sans chiffre » dans une phrase qui demande quand même un chiffre : retirée.
  const mixed = listen(listening, "C'est fait : j'ai remplacé le titre. Sans chiffre précis, combien d'invités environ ?");
  assert.ok(!mixed.includes("combien"), mixed);
});

test("type de question : « sans chiffre » n'en fait pas une question de chiffre", () => {
  assert.equal(intent.questionType("Tu veux que je la reformule maintenant, sans chiffre ?"), "detail");
  assert.equal(intent.questionType("Combien de personnes y participaient ?"), "chiffre");
});
