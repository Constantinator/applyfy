// Dernier lot du coach (C1) : sous 80, le CV n'est jamais dit « prêt » ni « in good shape » (seule
// la phrase concernée est remplacée par le score) ; CV libre sans poste visé : la question du poste
// visé, dans le premier message seulement. Lancé par `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, fakeClient, profile } from "./coach-test-fixtures.mjs";

const { claimsReady, listenText } = await import("./coach-intent.ts");
const { needsTargetQuestion, TARGET_QUESTION } = await import("./coach-prompt.ts");
const { coachBuilderCv, coachOpening } = await import("./coach-llm.ts");

const listening = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false };
const listen = (text, score, extra = {}) =>
  listenText({ text, mode: "parcours", lang: "en", listening, score, scoreBefore: score, corrections: [], previousCoach: [], ...extra });

test("« prêt » : phrases visées et phrases qui n'en sont pas", () => {
  for (const s of ["Your CV is in good shape, and you can still click any text.", "Le CV est prêt pour être envoyé.", "Ton CV est maintenant solide.", "Il est prêt à postuler.", "Your CV is ready to send."]) {
    assert.ok(claimsReady(s), s);
  }
  for (const s of ["Ta puce est prête.", "Ton accroche est bonne.", "Tu peux garder ton Master tel quel.", "Your summary looks good."]) {
    assert.ok(!claimsReady(s), s);
  }
});

test("sous 80 : seule la phrase « prêt » est remplacée par le score, une fois ; le reste est gardé", () => {
  assert.equal(
    listen("You're welcome, Sam. Your CV is in good shape, and you can still click any text in the preview. Ask me anytime.", 77),
    "You're welcome, Sam. Your CV is at 77/100 (threshold 80). Ask me anytime.",
  );
  assert.equal(
    listen("Oui, le résumé mentionne ton poste. Le CV est prêt pour être envoyé. Ton CV est solide.", 67, { lang: "fr" }),
    "Oui, le résumé mentionne ton poste. Ton CV est à 67/100 (seuil de 80).",
  );
});

test("pas de remplacement : à 80 ou plus, ou sans phrase « prêt »", () => {
  assert.equal(listen("Your CV is in good shape.", 82), "Your CV is in good shape.");
  assert.equal(listen("Ta puce est prête. Combien de clients ?", 70, { lang: "fr" }), "Ta puce est prête. Combien de clients ?");
});

test("« c'est prêt ? » sous 80 : la phrase du modèle est retirée, la réponse du serveur donne le score", () => {
  const text = listen("Your CV is in good shape. Add figures to your bullets.", 74, { listening: { ...listening, readiness: true } });
  assert.match(text, /^Not yet: your CV is at 74\/100 \(threshold 80\)\./);
  assert.doesNotMatch(text, /good shape/);
  assert.equal((text.match(/74\/100/g) ?? []).length, 1);
});

test("poste visé inconnu : CV libre, titre vide ou « Étudiant », sans poste visé, pas clos", () => {
  const etudiant = contextFor(profile("etudiant-stage-fr"), null);
  assert.equal(needsTargetQuestion(etudiant), true);
  const empty = { ...etudiant, cvJson: JSON.stringify({ personal: { jobTitle: "" } }) };
  assert.equal(needsTargetQuestion(empty), true);
});

test("poste visé connu ou sans objet : titre de métier, poste visé, CV lié, CV clos", () => {
  assert.equal(needsTargetQuestion(contextFor(profile("rh-stage-fr"), null)), false, "titre de métier");
  assert.equal(needsTargetQuestion(contextFor(profile("tech-confirme-en"), null)), false, "poste visé connu (L16)");
  const etudiant = contextFor(profile("etudiant-stage-fr"), null);
  assert.equal(needsTargetQuestion({ ...etudiant, analysis: { ...etudiant.analysis, targetJob: "Stage en banque" } }), false);
  assert.equal(needsTargetQuestion({ ...etudiant, offer: { position: "Stage", company: "X" } }), false, "CV lié");
  assert.equal(needsTargetQuestion({ ...etudiant, score: { ...etudiant.score, value: 85 } }), false, "CV clos");
});

test("la question n'est donnée qu'au premier message, jamais aux échanges suivants", async () => {
  const etudiant = contextFor(profile("etudiant-stage-fr"), null);
  const opening = fakeClient({ message: "Bonjour, quel poste vises-tu ?" });
  await coachOpening(opening, etudiant);
  assert.ok(opening.requests[0].system.includes(TARGET_QUESTION));
  const rh = fakeClient({ message: "Bonjour" });
  await coachOpening(rh, contextFor(profile("rh-stage-fr"), null));
  assert.ok(!rh.requests[0].system.includes(TARGET_QUESTION));
  const later = fakeClient({ mode: "parcours", change_summary: "", message: "Combien ?", skipped_points: [], updates: [] });
  await coachBuilderCv(later, contextFor(profile("etudiant-stage-fr"), null, { history: [], request: "Aide-moi" }), [], "Aide-moi");
  assert.ok(!later.requests[0].system.includes(TARGET_QUESTION));
});
