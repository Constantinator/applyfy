// Lot « corrections après le run » (run 2026-11-11T03-36-44) : chaque correction rejoue les
// messages réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");

const financeCv = profile("finance-junior-fr");
const analyste = detailOf("o-finance-analyste");

// --- 1. Raccourcir : seulement sur demande ---

/** Messages réels de la candidate en O01 (aucun ne demande de raccourcir). */
const O01 = [
  "Oui, d'accord pour le résumé. Avant, peux-tu y ajouter des chiffres ? Chez Banque Fictive, je prépare 40 dossiers de crédit par mois pour des PME, et mon modèle Excel de suivi de trésorerie a réduit la clôture mensuelle de 2 jours. Pendant mon stage d'audit, j'ai participé à 6 missions de commissariat aux comptes.",
  "Je ne comprends pas bien : je n'ai pas demandé de raccourcir le résumé, j'ai demandé d'y ajouter mes chiffres. Pourrais-tu réessayer en gardant tous les chiffres : 40 dossiers de crédit par mois, réduction de la clôture mensuelle de 2 jours, et 6 missions de commissariat aux comptes ? Je ne sais pas quoi retirer, donc je préfère tout garder.",
  "Je suis un peu bloqué : tu dis toujours que le résumé doit être raccourci, alors que je te demande juste d'ajouter les chiffres. Peux-tu écrire le résumé avec les 3 chiffres sans rien retirer d'autre ? Si c'est vraiment impossible sans raccourcir, dis-moi au moins quelle phrase je peux modifier, car je ne sais pas quoi enlever.",
  "Je suis toujours bloqué sur le même point. Je ne te demande pas de raccourcir le résumé, seulement d'y ajouter mes 3 chiffres. Peux-tu me proposer une version qui les contient, même si elle est un peu plus longue ?",
  "Désolé, je suis toujours bloqué. Je ne veux pas raccourcir le résumé, je veux juste ajouter mes 3 chiffres, même si la version finale est plus longue.",
  "Je n'ai demandé aucune réduction, seulement d'ajouter 3 chiffres au résumé.",
];

test("raccourcir : demande reconnue, jamais un fait raconté ni une négation", () => {
  for (const message of O01) assert.equal(intent.asksToShorten(message), false, message);
  assert.equal(intent.asksToShorten("…qui a réduit la clôture mensuelle de 2 jours."), false);
  assert.equal(intent.asksToShorten("Mon outil a réduit le temps de traitement."), false);
  for (const message of [
    "Raccourcis mon accroche, elle est trop longue.",
    "Peux-tu raccourcir ma deuxième puce ?",
    "Mon résumé est trop long.",
    "Réduis la longueur du résumé.",
    "Fais-le plus court stp",
    "Condense mon expérience chez X.",
    "Shorten my summary please.",
    "Can you make it shorter?",
    "My summary is too long.",
  ]) {
    assert.equal(intent.asksToShorten(message), true, message);
  }
  for (const message of ["Ne raccourcis pas mon résumé.", "Garde-le sans raccourcir.", "Don't shorten it, just add the number."]) {
    assert.equal(intent.asksToShorten(message), false, message);
  }
});

test("rejeu O01 : ajouter des chiffres au résumé n'est jamais refusé pour « pas assez courte »", async () => {
  const opening = [{ role: "assistant", content: "Je te propose de réécrire ton résumé pour l'offre. Tu es d'accord ?" }];
  const longer =
    "Analyste financière junior chez Banque Fictive : 40 dossiers de crédit PME préparés par mois, modèle Excel de suivi de trésorerie qui a réduit la clôture mensuelle de 2 jours. Audit légal chez Cabinet Exemple Audit : 6 missions de commissariat aux comptes.";
  for (const [i, request] of O01.entries()) {
    // Historique réel : les chiffres ont été donnés au premier message.
    const history = i === 0 ? opening : [...opening, { role: "user", content: O01[0] }, { role: "assistant", content: "Je n'ai pas pu faire cette modification." }];
    const context = contextFor(financeCv, analyste, { history, request });
    assert.equal(context.listening.shorten, false);
    const result = await turn(financeCv, context, history, request, flat({ mode: "demande", section: "summary", data: longer, change_summary: "C'est fait." }));
    assert.equal(result.updated.summary, longer, request);
    assert.ok(!/raccourcir|pas assez courte/.test(result.text), result.text);
    assert.ok(![...result.firstProblems, ...result.problems].some((p) => p.problems.some((x) => x.includes("pas assez courte"))));
  }
});

test("raccourcir : jamais en mode parcours (O02, puce enrichie d'un chiffre)", async () => {
  const history = [{ role: "assistant", content: "As-tu un chiffre pour l'analyse des dossiers ?" }];
  // Message qui demande de raccourcir, mais réponse du coach en mode parcours : pas de règle des 20 %.
  const request = "Raccourcis si tu veux, mais j'analyse 40 dossiers par mois.";
  const context = contextFor(financeCv, null, { history, request });
  const data = JSON.stringify({ id: "fj-e1", bullets: [{ index: 0, after: "Analyse de 40 dossiers de crédit PME par mois" }] });
  const result = await turn(financeCv, context, history, request, flat({ section: "experience", data, change_summary: "C'est fait." }));
  assert.equal(result.updated.experiences[0].bullets[0], "Analyse de 40 dossiers de crédit PME par mois");
});

test("raccourcir : le nombre de mots annoncé vient du serveur, jamais du modèle", async () => {
  const history = [{ role: "assistant", content: "Bonjour." }];
  const request = "Raccourcis mon accroche.";
  const context = contextFor(financeCv, null, { history, request });
  const result = await turn(
    financeCv,
    context,
    history,
    request,
    flat({ mode: "demande", section: "summary", data: "Analyste financière junior, banque et audit.", change_summary: "C'est fait : j'ai raccourci ton résumé de 12 à 9 mots." }),
  );
  assert.ok(!result.text.includes("12 à 9"), result.text);
  assert.match(result.text, /Le texte passe de 15 à 6 mots\./);
  // Sans demande de raccourcir : aucun nombre de mots annoncé.
  const add = "Ajoute 40 dossiers par mois à mon résumé.";
  const plain = await turn(
    financeCv,
    contextFor(financeCv, null, { history, request: add }),
    history,
    add,
    flat({ mode: "demande", section: "summary", data: `${financeCv.summary} 40 dossiers par mois.`, change_summary: "C'est fait : 20 mots au lieu de 16." }),
  );
  assert.ok(!/\bmots\b/.test(plain.text), plain.text);
});

// --- 6. Titre mensonger : jamais le titre de l'offre quand l'écart est « métier » ---

const { coachSystem } = await import("./coach-prompt.ts");
const { scenarios } = await import("./coach-test-fixtures.mjs");

test("écart « métier » : seuls O02 et O03 ; O04 (étudiant, titre décalé) garde son étape titre", () => {
  const linked = scenarios.filter((s) => s.case === "lie" && s.set === "dev");
  const gaps = Object.fromEntries(linked.map((s) => [s.id, contextFor(profile(s.profile), detailOf(s.offer)).offerGap]));
  assert.deepEqual(
    Object.keys(gaps).filter((id) => gaps[id] === "metier"),
    ["O02-finance-vers-tech", "O03-ecart-trop-grand"],
  );
  for (const id of ["O01-meme-metier", "O06-demande-puce-lie", "O07-vague-lie", "O08-injection-offre", "O09-offre-en", "O10-offre-langue"]) {
    assert.notEqual(gaps[id], "metier", id);
  }
  const o04 = contextFor(profile("tech-stage-fr"), detailOf("o-finance-analyste"));
  assert.equal(o04.offerSteps[0], "titre");
  assert.equal(o04.offerStudent, true);
  for (const [cv, offer] of [["finance-junior-fr", "o-tech-backend"], ["commercial-junior-fr", "o-tech-java-senior"]]) {
    const ctx = contextFor(profile(cv), detailOf(offer));
    assert.ok(!ctx.offerSteps.includes("titre"), cv);
  }
});

test("écart « métier » : consigne fixe, titre de l'offre refusé, titre de reconversion seulement sur demande", async () => {
  const cv = profile("commercial-junior-fr");
  const java = detailOf("o-tech-java-senior");
  const history = [{ role: "assistant", content: "Je te propose de réécrire ton résumé. D'accord ?" }];
  const system = coachSystem(contextFor(cv, java, { history, request: "oui" }), "");
  assert.ok(system.includes("Le candidat n'a aucune expérience dans le métier de cette offre : le titre du CV reste le sien."));
  assert.ok(!system.includes("Étape à proposer dans « message » : le titre."));
  // O04 : consigne « étudiant » avec l'étape titre, pas de consigne « métier ».
  const o04 = coachSystem(contextFor(profile("tech-stage-fr"), detailOf("o-finance-analyste"), { history, request: "oui" }), "");
  assert.ok(o04.includes("Le candidat est étudiant ou stagiaire : un titre proposé garde ce statut"));
  assert.ok(!o04.includes("aucune expérience dans le métier de cette offre"));

  const title = (mode, jobTitle) => flat({ mode, section: "personal", data: JSON.stringify({ jobTitle }), change_summary: "C'est fait." });
  const run = (request, reply) => turn(cv, contextFor(cv, java, { history, request }), history, request, reply);
  const java1 = await run("oui", title("parcours", "Développeur Java"));
  assert.equal(java1.updated.personal.jobTitle, cv.personal.jobTitle);
  assert.ok(java1.text.includes("un métier que ton CV ne montre pas"));
  const asked = "Mets comme titre « Commercial terrain, en reconversion vers le développement Java ».";
  const honest = await run(asked, title("demande", "Commercial terrain, en reconversion vers le développement Java"));
  assert.equal(honest.updated.personal.jobTitle, "Commercial terrain, en reconversion vers le développement Java");
  // Même titre proposé par le coach de lui-même (parcours) : refusé.
  const notAsked = await run("oui", title("parcours", "Commercial terrain, en reconversion vers le développement Java"));
  assert.equal(notAsked.updated.personal.jobTitle, cv.personal.jobTitle);
});
