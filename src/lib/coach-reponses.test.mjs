// Lot « corrections de réponses du coach » (run 2026-11-15T23-04-28) : chaque correction rejoue
// les messages réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const intent = await import("./coach-intent.ts");

// --- 1. « Si oui, je m'arrête » n'est pas une question « prêt ? » ---

/** Messages réels de L17 (échanges 8 et 10) : question sur la langue, pas sur le score. */
const L17 = [
  "ok good. quick check pls, is everything in french now incl. section titles and dates? if yes im done",
  "ok so is the whole cv really in french then, titles and dates incl? yes or no. if yes i'm done, no more rounds",
];

test("L17 rejoué : une question sur la langue suivie de « if yes im done » ne reçoit pas le score", () => {
  const history = [{ role: "assistant", content: "Done, I've updated: Languages. That's everything: your whole CV is now in French. Tell me if you want any other change." }];
  for (const request of L17) {
    const state = intent.listeningState(history, request);
    assert.equal(state.readiness, false, request);
    assert.ok(!("stopIfReady" in state), request);
    const text = intent.listenText({
      text: "Yes: all the texts in your CV are in French, and the section titles and the date format are in French as well.",
      mode: "parcours",
      lang: "en",
      listening: state,
      score: 75,
      scoreBefore: 75,
      corrections: [],
      previousCoach: [],
    });
    assert.ok(!text.startsWith("Not yet"), text);
  }
});

test("si oui : non-déclenchement sur une question qui ne porte pas sur le CV prêt", () => {
  for (const message of [
    ...L17,
    "La puce est bien ajoutée ? Si oui, on peut s'arrêter là.",
    "c'est bien en français ? si c'est le cas je m'arrête",
    "Is the summary in French now? If so, we can stop.",
  ]) {
    assert.equal(intent.asksToStopIfReady(message), false, message);
    assert.equal(intent.listeningState([], message).readiness, false, message);
  }
});

test("si oui : déclenchement quand la question porte sur le CV prêt", () => {
  for (const message of [
    "Est-ce que ton CV est prêt pour une candidature commerciale ? Si oui, on peut s'arrêter là.",
    "Est-ce que mon CV est prêt ? Si oui, on peut s'arrêter là.",
    "Is my CV ready? If so, we can stop.",
    "Tu peux l'indiquer dans la puce, et on pourra s'arrêter là si ton CV est prêt.",
    "If it's ready, we can stop there.",
  ]) {
    assert.equal(intent.asksToStopIfReady(message), true, message);
    assert.equal(intent.asksToStop(message), false, message);
    assert.equal(intent.listeningState([], message).readiness, true, message);
  }
});

// --- 2. L'annonce d'une modification ne commence pas par « Oui : » ou « Non : » ---

const outcome = await import("./coach-outcome.ts");

/** Réponse appliquée d'un projet (O04, échange 6) : annonce du modèle reprise telle quelle. */
const applied = (changeSummary, message = "", over = {}) => ({
  mode: "demande",
  section: "projects",
  applied: 1,
  stale: 0,
  invalid: false,
  firstInvalid: false,
  noChange: false,
  problems: [],
  firstProblems: [],
  message,
  changeSummary,
  appliedLabels: ["Projet API REST en Node.js"],
  summaryFaithful: true,
  scoreBefore: 64,
  scoreAfter: 64,
  corrections: [],
  offerKeywords: [],
  ...over,
});

test("O04 rejoué : « Non : j'ai ajouté un nouveau projet… » n'est plus affiché", () => {
  const text = outcome.coachReplyText(
    applied(
      "Non : j'ai ajouté un nouveau projet « API REST en Node.js » (projet de fin d'études), utilisé par 3 équipes de ton école.",
      "Ton titre « Étudiant en informatique » reste inchangé et la puce sur les réunions d'équipe aussi.",
    ),
  );
  assert.ok(text.startsWith("J'ai ajouté un nouveau projet « API REST en Node.js »"), text);
  assert.ok(text.includes("Ton titre « Étudiant en informatique » reste inchangé"), text);
});

test("annonce oui/non : retirée en français et en anglais, quelle que soit la ponctuation", () => {
  for (const [summary, expected] of [
    ["Oui, j'ai ajouté ta certification.", "J'ai ajouté ta certification."],
    ["non. J'ai ajouté le projet.", "J'ai ajouté le projet."],
    ["No: I added the project.", "I added the project."],
    ["Yes! I added the project.", "I added the project."],
  ]) {
    assert.equal(outcome.coachReplyText(applied(summary, "", { lang: /^(No|Yes)/.test(summary) ? "en" : "fr" })), expected, summary);
  }
  // Annonce réduite à « Non : » : annonce du serveur à la place.
  assert.equal(outcome.coachReplyText(applied("Non :")), "C'est fait, j'ai modifié : Projet API REST en Node.js.");
});

test("annonce oui/non : non-déclenchement (autres débuts, message sans modification, rien d'autre que oui/non)", () => {
  for (const summary of ["Nouveau projet ajouté : API REST en Node.js.", "Notoriété du projet précisée.", "Non-régression : projet ajouté.", "Nonante utilisateurs ajoutés.", "C'est fait : projet ajouté."]) {
    assert.equal(outcome.coachReplyText(applied(summary)), summary, summary);
  }
  // Sans modification voulue, le message du modèle reste tel quel (réponse à une question).
  assert.equal(outcome.coachReplyText(applied("", "Non : je garde la puce telle quelle.", { section: null, applied: 0 })), "Non : je garde la puce telle quelle.");
  // « Oui : ton CV est à … » du serveur (listenText) n'est pas concerné.
  const ready = intent.listenText({ text: "Rien d'autre.", mode: "parcours", lang: "fr", listening: { stopAll: false, stopFigures: false, readiness: true, confirmation: false, refusal: false, shorten: false }, score: 85, scoreBefore: 85, corrections: [], previousCoach: [] });
  assert.ok(ready.startsWith("Oui : ton CV est à 85/100"), ready);
});
