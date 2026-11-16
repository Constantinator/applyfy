// Lot C du coach (runs 2026-11-15T23-04-28 et 2026-11-16T00-45-04) : questions de mois une seule
// fois, puce sans chiffre quand le candidat n'en a pas, phrase « projet d'école », plafonds des
// mots-clés de l'offre, seuil de gain. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, profile } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");
const { coachSystem } = await import("./coach-prompt.ts");

// --- 1. Questions de mois : une seule fois par CV ---

const MONTH_Q = "Pour ton stage chez Startup Exemple, tes dates indiquent seulement l'année : peux-tu me donner les mois de début et de fin ?";

test("mois : une question posée une fois, même avec une réponse, n'est plus reposée (O04 du 15/11)", () => {
  const state = intent.listeningState([{ role: "assistant", content: MONTH_Q }], "Le stage a duré de juin 2025 à août 2025.");
  assert.equal(state.monthsAsked, true);
  assert.equal(state.stopMonths, undefined);
  // Plus tard dans la session, toujours vrai.
  const later = intent.listeningState(
    [
      { role: "assistant", content: MONTH_Q },
      { role: "user", content: "De juin à août 2025." },
      { role: "assistant", content: "C'est fait. Combien de bugs as-tu corrigés ?" },
    ],
    "Une vingtaine.",
  );
  assert.equal(later.monthsAsked, true);
});

test("mois : un refus est compté même si la question de mois n'est pas la dernière du message", () => {
  const h = [{ role: "assistant", content: "À quel mois as-tu commencé chez Société Fictive ? Et combien de clients suivais-tu ?" }];
  const state = intent.listeningState(h, "Je ne sais pas le mois exact, c'était en 2023.");
  assert.equal(state.stopMonths, true);
  assert.equal(state.monthsAsked, undefined, "le refus a sa propre consigne");
});

test("mois : non-déclenchement (question « par mois », aucune question de mois, demande d'ajouter les mois)", () => {
  const perMonth = intent.listeningState([{ role: "assistant", content: "Combien de dossiers traitais-tu par mois ?" }], "Une quarantaine.");
  assert.ok(!("monthsAsked" in perMonth) && !("stopMonths" in perMonth));
  const none = intent.listeningState([{ role: "assistant", content: "Combien de clients ?" }], "80.");
  assert.ok(!("monthsAsked" in none));
  // O03 : le candidat demande lui-même d'ajouter les mois.
  const asked = intent.listeningState(
    [{ role: "assistant", content: MONTH_Q }, { role: "user", content: "Je ne me souviens plus." }, { role: "assistant", content: "Pas de souci." }],
    "Tu peux ajouter les mois sur mes dates si ça aide.",
  );
  assert.equal(asked.stopMonths, true, "le refus précédent reste");
  const request = intent.listeningState([{ role: "assistant", content: MONTH_Q }], "Ajoute les mois sur mes dates : juin à août.");
  assert.ok(!("monthsAsked" in request));
  // Anglais : même règle.
  const en = intent.listeningState([{ role: "assistant", content: "Which month did you start at Example Tech?" }], "March 2021.");
  assert.equal(en.monthsAsked, true);
});

const listening = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false, monthsAsked: true };
const base = { mode: "parcours", lang: "fr", previousCoach: [MONTH_Q] };
const corrections = ["Dates sans mois ou incomplètes — Vendeur chez Boutique Exemple", "2 puces sans chiffre — Vendeur chez Boutique Exemple"];

test("mois : question retirée seule, CV pas clos : point suivant, ni « je n'insiste pas » ni « Dis-moi si »", () => {
  const text = intent.listenText({ ...base, listening, score: 62, scoreBefore: 62, corrections, text: "Pour ton poste de Vendeur chez Boutique Exemple, à quels mois as-tu commencé et terminé ?" });
  assert.equal(text, "Je ne te redemande pas les mois de tes dates. On passe au point suivant : 2 puces sans chiffre — Vendeur chez Boutique Exemple.");
  assert.ok(!text.includes("insiste") && !text.includes("Dis-moi si"));
  // Plus aucun point (hors dates) : clôture du parcours, pas « Dis-moi si ».
  const done = intent.listenText({ ...base, listening, score: 74, scoreBefore: 74, corrections: corrections.slice(0, 1), text: "À quel mois as-tu commencé ?" });
  assert.ok(done.startsWith("J'ai fait le tour des points à corriger."), done);
});

test("mois : question retirée seule, CV clos : phrase courte de clôture", () => {
  const text = intent.listenText({ ...base, listening, score: 85, scoreBefore: 85, corrections, text: "À quel mois as-tu commencé ?" });
  assert.equal(text, "Dis-moi si tu veux une modification précise.");
});

test("mois : seule la question de mois est retirée, le reste du message est gardé ; refus : comportement inchangé", () => {
  const text = intent.listenText({
    ...base,
    listening,
    score: 62,
    scoreBefore: 62,
    corrections,
    text: "C'est fait. Pour ton poste de Vendeur, combien de clients conseillais-tu par jour ? Et à quel mois as-tu commencé ?",
  });
  assert.equal(text, "C'est fait. Pour ton poste de Vendeur, combien de clients conseillais-tu par jour ?");
  const refused = intent.listenText({ ...base, listening: { ...listening, monthsAsked: undefined, stopMonths: true, refusal: true }, score: 62, scoreBefore: 62, corrections, text: "À quel mois as-tu commencé ?" });
  assert.ok(refused.startsWith("Pas de souci, je n'insiste pas."), refused);
});

test("mois : consigne fixe dans le bloc « situation »", () => {
  const ctx = { ...contextFor(profile("tech-stage-fr")), listening };
  assert.ok(coachSystem(ctx, "").includes("Tu as déjà posé une question sur les mois des dates"));
});
