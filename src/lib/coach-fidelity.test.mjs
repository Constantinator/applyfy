// Lot « fidélité des puces et des annonces » (run 2026-11-12T21-20-02) : chaque correction rejoue
// les messages réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, fakeClient, flat, profile, quiet } from "./coach-test-fixtures.mjs";

const { coachBuilderCv } = await import("./coach-llm.ts");
const { runCoachTurn } = await import("./coach-turn.ts");

/** Un échange avec deux réponses du modèle : la première, puis celle du second essai. */
async function twoTries(cv, context, history, request, first, second) {
  const reply = await coachBuilderCv(fakeClient(first), context, history, request);
  return quiet(() =>
    runCoachTurn({
      current: cv,
      context,
      turns: history,
      request,
      reply,
      limitReached: false,
      retry: (retry) => coachBuilderCv(fakeClient(second), context, history, request, retry),
    }),
  );
}

// --- 1. Annonce : seul un texte réellement refusé au final est « pas appliqué » ---

test("rejeu L04 : second essai accepté, aucune cause du premier refus dans l'annonce", async () => {
  const cv = profile("conseil-confirme-fr");
  const history = [{ role: "assistant", content: "Ton CV est prêt : il atteint 85/100 (seuil de 80)." }];
  const request = "Raccourcis mon accroche, elle est trop longue.";
  const context = contextFor(cv, null, { history, request });
  // Premier essai réel du run : 37 mots, refusé « pas assez courte ».
  const tooLong =
    "Consultant senior en stratégie et transformation, 7 ans d'expérience auprès de directions générales de l'industrie et de la distribution. Pilotage de programmes de réduction des coûts et de réorganisation, du diagnostic à la mise en œuvre.";
  const shorter =
    "Consultant senior en stratégie et transformation, 7 ans d'expérience auprès de directions générales de l'industrie et de la distribution. Pilotage de programmes de réduction des coûts et de réorganisation.";
  const result = await twoTries(
    cv,
    context,
    history,
    request,
    flat({ mode: "demande", section: "summary", data: tooLong, change_summary: "C'est fait." }),
    flat({ mode: "demande", section: "summary", data: shorter, change_summary: "C'est fait." }),
  );
  assert.equal(result.retried, true);
  assert.equal(result.problems.length, 0);
  assert.equal(result.updated.summary, shorter);
  assert.ok(!/n'a pas été appliquée|pas assez courte|raccourcir d'au moins/.test(result.text), result.text);
  assert.ok(result.text.startsWith("C'est fait. Le texte passe de 39 à 29 mots."), result.text);
});

test("annonce : une puce abandonnée au second essai reste signalée", async () => {
  const cv = profile("finance-junior-fr");
  const history = [{ role: "assistant", content: "Combien de dossiers traitais-tu ?" }];
  const request = "J'en traitais 40 par mois, et je formais les nouveaux.";
  const context = contextFor(cv, null, { history, request });
  const data = (bullets) => JSON.stringify({ id: "fj-e1", bullets });
  const result = await twoTries(
    cv,
    context,
    history,
    request,
    flat({ section: "experience", data: data([{ index: 0, after: "Analyse de 40 dossiers de crédit PME par mois" }, { index: -1, after: "Formation des nouveaux arrivants" }]), change_summary: "C'est fait." }),
    // Second essai : la puce sans chiffre est abandonnée, l'autre est gardée.
    flat({ section: "experience", data: data([{ index: 0, after: "Analyse de 40 dossiers de crédit PME par mois" }]), change_summary: "C'est fait." }),
  );
  assert.equal(result.updated.experiences[0].bullets[0], "Analyse de 40 dossiers de crédit PME par mois");
  assert.ok(!result.updated.experiences[0].bullets.includes("Formation des nouveaux arrivants"));
  assert.ok(/n'ont pas été ajoutées|Pas modifié/.test(result.text), result.text);
});
