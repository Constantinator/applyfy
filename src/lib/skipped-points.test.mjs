// Lot score (S5) : étapes de l'offre faites, identifiées par un objet { step } que seul le serveur
// crée ; le modèle n'écrit que des textes et ne peut plus valider une étape en écrivant
// « offre:titre ». Anciennes conversations (marqueurs texte) relues. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { contextFor, detailOf, fakeClient, flat, profile } from "./coach-test-fixtures.mjs";

const { mergeSkipped, readSkipped, stepOf } = await import("./skipped-points.ts");
const { boundSkipped, doneOfferSteps, offerStageOf } = await import("./coach-offer.ts");
const { coachBuilderCv } = await import("./coach-llm.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("readSkipped : textes et étapes ; anciens marqueurs relus comme étapes ; le reste ignoré", () => {
  assert.deepEqual(readSkipped(["Stage : heures", "offre:titre", { step: "resume" }, { step: "inconnue" }, 3, "", null, "offre:titre"]), [
    "Stage : heures",
    { step: "titre" },
    { step: "resume" },
  ]);
  assert.deepEqual(readSkipped("offre:titre"), []);
  assert.equal(stepOf("Stage : heures"), null);
  assert.deepEqual(mergeSkipped([{ step: "titre" }, "a"], ["a", { step: "titre" }, { step: "ecart" }]), [{ step: "titre" }, "a", { step: "ecart" }]);
});

test("boundSkipped : étapes gardées en tête, hors de la limite des textes", () => {
  const points = [{ step: "titre" }, ...Array.from({ length: 60 }, (_, i) => `point ${i}`)];
  const bounded = boundSkipped(points, 50);
  assert.deepEqual(bounded[0], { step: "titre" });
  assert.equal(bounded.length, 51);
  assert.deepEqual(doneOfferSteps(bounded), new Set(["titre"]));
});

test("le modèle ne peut pas valider une étape : « offre:titre » dans skipped_points est retiré", async () => {
  const finance = profile("finance-junior-fr");
  const backend = detailOf("o-tech-backend");
  const context = contextFor(finance, backend, { history: [], request: "Aide-moi" });
  const reply = await coachBuilderCv(
    fakeClient(flat({ mode: "demande", message: "D'accord.", skipped_points: ["offre:titre", "OFFRE:resume", "Stage : heures"] })),
    context,
    [],
    "Aide-moi",
  );
  assert.deepEqual(reply.skippedPoints, ["Stage : heures"]);
  // Même relue par l'éditeur, la liste ne contient aucune étape faite.
  assert.equal(doneOfferSteps(readSkipped(reply.skippedPoints)).size, 0);
  const steps = context.offerSteps;
  assert.ok(steps.includes("resume"));
  assert.ok(offerStageOf({ offerSteps: steps, skipped: readSkipped(reply.skippedPoints) }, false));
});

test("action et éditeur : liste revalidée par readSkipped, fusion sans doublon", () => {
  assert.match(read("app/actions/cv-builder.ts"), /boundSkipped\(readSkipped\(value\), SKIPPED_MAX\)/);
  const editor = read("components/cv-builder/cv-builder-editor.tsx");
  assert.match(editor, /skipped\.current = readSkipped\(row\?\.skipped_points\)/);
  assert.match(editor, /mergeSkipped\(skipped\.current, result\.skippedPoints\)/);
});
