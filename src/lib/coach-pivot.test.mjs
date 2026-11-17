// Dernier lot du coach (C2) : pivot d'un CV libre (L14). Le serveur lit la nouvelle cible dans les
// messages du candidat ; le coach propose une fois un titre lié ; l'écart est dit une fois par le
// serveur avant de conclure, seulement si les mots de la cible manquent aux postes et aux puces.
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, flat, profile, turn } from "./coach-test-fixtures.mjs";

const { coachPivot, pivotGapSentence, statedTarget } = await import("./coach-pivot.ts");
const { coachSystem, pivotTitleSentence } = await import("./coach-prompt.ts");
const { listenText } = await import("./coach-intent.ts");

const marketing = profile("marketing-junior-fr");
const PIVOT = "En fait je vise plutôt un poste de chef de projet événementiel.";
const say = (content) => ({ role: "user", content });
const coach = (content) => ({ role: "assistant", content });

test("cible déclarée : français, anglais, phrase du run L14", () => {
  assert.equal(statedTarget(PIVOT), "chef de projet événementiel");
  assert.equal(statedTarget("Mais comme je vise maintenant un poste de chef de projet événementiel, peux-tu proposer une accroche ?"), "chef de projet événementiel");
  assert.equal(statedTarget("Je veux devenir développeur backend, adapte mon CV pour ça."), "développeur backend");
  assert.equal(statedTarget("I'm now targeting a role as product manager."), "product manager");
});

test("pas de cible : négation, « je vise trop haut », phrase sans métier", () => {
  assert.equal(statedTarget("Je ne vise pas un poste de manager."), null);
  assert.equal(statedTarget("Tu crois que je vise trop haut ?"), null);
  assert.equal(statedTarget("Je cherche mes chiffres de l'an dernier."), null);
});

test("pivot : cible différente du titre, CV libre ; dernière déclaration retenue", () => {
  const pivot = coachPivot(marketing, [coach("Combien d'abonnés ?"), say(PIVOT)], "Ok", false);
  assert.deepEqual(pivot, { target: "chef de projet événementiel", titleProposed: false, gap: true });
  // Retour à la cible du titre : plus de pivot.
  assert.equal(coachPivot(marketing, [say(PIVOT), coach("D'accord.")], "Finalement je vise un poste de chargée de marketing digital.", false), null);
  assert.equal(coachPivot(marketing, [], "Je vise un poste de chargée de marketing digital", false), null, "même cible que le titre");
  assert.equal(coachPivot(marketing, [say(PIVOT)], "Ok", true), null, "CV lié : l'offre fixe la cible");
  assert.equal(coachPivot(marketing, [], "Aide-moi à améliorer mon CV.", false), null, "aucune déclaration");
});

test("titre déjà proposé après le pivot : plus de consigne ; écart déjà dit : plus de phrase", () => {
  const proposed = coachPivot(marketing, [say(PIVOT), coach("Veux-tu que je change ton titre en « Chargée de projet événementiel » ?")], "Oui", false);
  assert.equal(proposed.titleProposed, true);
  assert.ok(!coachSystem({ ...contextFor(marketing, null), pivot: proposed }, "").includes("Le candidat vise maintenant"));
  const gap = pivotGapSentence("chef de projet événementiel", marketing.personal.jobTitle, "fr");
  assert.equal(coachPivot(marketing, [say(PIVOT), coach(`Ok. ${gap} J'ai fait le tour.`)], "Merci", false).gap, false);
});

test("écart : seulement si les mots de la cible (5 lettres ou plus) manquent aux postes et aux puces", () => {
  const close = { ...marketing, experiences: [{ ...marketing.experiences[0], bullets: ["Coordination d'un projet événementiel pour 300 invités"] }] };
  assert.equal(coachPivot(close, [say(PIVOT)], "Ok", false).gap, false);
});

test("consigne du titre dans le bloc situation, jamais pour un CV libre sans pivot", () => {
  const withPivot = contextFor(marketing, null, { history: [say(PIVOT), coach("Noté.")], request: "Ok" });
  assert.ok(coachSystem(withPivot, "").includes(pivotTitleSentence("chef de projet événementiel")));
  assert.equal("pivot" in contextFor(marketing, null, { history: [], request: "Aide-moi" }), false);
});

test("phrase d'écart insérée une fois, avant la phrase qui conclut ; rien sans conclusion", () => {
  const gap = pivotGapSentence("chef de projet événementiel", "Chargée de marketing digital", "fr");
  const base = { mode: "parcours", lang: "fr", listening: { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false }, score: 77, scoreBefore: 77, corrections: [], previousCoach: [] };
  assert.equal(
    listenText({ ...base, text: "Pas de souci. J'ai fait le tour des points à corriger.", pivotGap: gap }),
    `Pas de souci. ${gap} J'ai fait le tour des points à corriger.`,
  );
  assert.equal(listenText({ ...base, text: "Combien d'événements as-tu organisés ?", pivotGap: gap }), "Combien d'événements as-tu organisés ?");
});

test("échange complet (L14) : l'écart précède la clôture du parcours", async () => {
  const history = [coach("Combien d'abonnés ?"), say(PIVOT), coach("Noté. Ton accroche est-elle à jour ?")];
  const request = "Oui, merci, c'est bon pour moi.";
  const result = await turn(marketing, contextFor(marketing, null, { history, request }), history, request, flat({ message: "J'ai fait le tour des points à corriger." }));
  assert.match(result.text, /Pour un poste de « chef de projet événementiel », ton CV montre encore surtout ton parcours de Chargée de marketing digital/);
  assert.ok(result.text.indexOf("Pour un poste de") < result.text.indexOf("J'ai fait le tour"));
});
