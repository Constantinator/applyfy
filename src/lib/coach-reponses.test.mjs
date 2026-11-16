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
