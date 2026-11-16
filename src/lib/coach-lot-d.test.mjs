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

// --- 3. Réponse « prêt ? » : pas de faux « prêt ? », pas de bloc redit, pas de double réponse ---

test("« Est-ce que ça suffit pour reformuler la puce ? » n'est pas une question « prêt ? » (L14, tour 4)", () => {
  assert.equal(intent.isReadinessQuestion("Est-ce que ça suffit pour reformuler la puce ?"), false);
  assert.equal(intent.isReadinessQuestion("Is that enough to rewrite the bullet?"), false);
  // Toujours des questions « prêt ? ».
  assert.equal(intent.isReadinessQuestion("Est-ce que ça suffit ?"), true);
  assert.equal(intent.isReadinessQuestion("Est-ce que ça suffit pour postuler ?"), true);
  assert.equal(intent.isReadinessQuestion("Est-ce que c'est suffisant pour envoyer ma candidature ?"), true);
  assert.equal(intent.isReadinessQuestion("Is that enough?"), true);
  assert.equal(intent.isReadinessQuestion("Is it enough to apply?"), true);
  assert.equal(intent.isReadinessQuestion("Est-ce que mon CV est prêt ?"), true);
});

const READY = { stopAll: false, stopFigures: false, readiness: true, confirmation: false, refusal: false, shorten: false };
const GAPS = ["7 mots-clés du métier sur 10 visés (Marketing & Communication) (+4 pts)", "2 puces seulement (vise 3 à 6) — Assistante communication chez Agence Exemple (+3 pts)"];
const BLOCK = "Ce qui bloque surtout : 7 mots-clés du métier sur 10 visés (Marketing & Communication) ; 2 puces seulement (vise 3 à 6) — Assistante communication chez Agence Exemple.";

test("« prêt ? » : ce qui bloque, déjà dit mot pour mot, n'est pas redit (L14, tours 7 et 8)", () => {
  const first = listen(READY, "Il reste surtout à étoffer ton CV.", { score: 75, scoreBefore: 75, corrections: GAPS, mode: "parcours" });
  assert.ok(first.startsWith(`Pas encore : ton CV est à 75/100 (seuil de 80). ${BLOCK}`), first);
  const second = listen(READY, "C'est fait : ton accroche commence maintenant par « Chargée… ».", {
    score: 77,
    scoreBefore: 75,
    corrections: GAPS,
    previousCoach: [first],
  });
  assert.ok(second.startsWith("Pas encore : ton CV est à 77/100 (seuil de 80). C'est fait"), second);
  assert.ok(!second.includes("Ce qui bloque surtout"), second);
  // Autres points bloquants : redits.
  const other = listen(READY, "Il reste peu.", { score: 77, scoreBefore: 75, corrections: ["3 puces sans chiffre — Vendeur (+5 pts)"], previousCoach: [first] });
  assert.ok(other.includes("Ce qui bloque surtout : 3 puces sans chiffre — Vendeur."), other);
});

test("« prêt ? » : « Pas tout à fait : » du modèle retiré quand le serveur a répondu (L15, tour 7)", () => {
  const text =
    "C'est fait : j'ai changé le titre de ton CV en « Commercial terrain B2B ». Pas tout à fait : le plus important qui reste, c'est d'étoffer ton poste de Vendeur.";
  const shown = listen(READY, text, { score: 64, scoreBefore: 64, corrections: ["2 puces sans chiffre — Vendeur chez Boutique Exemple (+5 pts)"] });
  assert.equal(
    shown,
    "Pas encore : ton CV est à 64/100 (seuil de 80). Ce qui bloque surtout : 2 puces sans chiffre — Vendeur chez Boutique Exemple. C'est fait : j'ai changé le titre de ton CV en « Commercial terrain B2B ». Le plus important qui reste, c'est d'étoffer ton poste de Vendeur.",
  );
  assert.ok(listen(READY, "Pas encore, il manque des chiffres.", { score: 60 }).endsWith(" Il manque des chiffres."));
  const en = listen(READY, "Not yet: add figures to your internship.", { score: 60, lang: "en" });
  assert.equal(en, "Not yet: your CV is at 60/100 (threshold 80). Add figures to your internship.");
  // Sans réponse du serveur (pas de question « prêt ? ») : la phrase du modèle reste telle quelle.
  const none = listen({ ...READY, readiness: false }, "Pas encore : il manque des chiffres.", { score: 60 });
  assert.equal(none, "Pas encore : il manque des chiffres.");
  // « Pas encore » au milieu d'une phrase : gardé.
  const mid = listen(READY, "Ton accroche n'a pas encore de chiffre.", { score: 60 });
  assert.ok(mid.endsWith("Ton accroche n'a pas encore de chiffre."), mid);
});
