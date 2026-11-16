// Lot « consignes du coach » (run 2026-11-16T00-45-04) : chaque correction rejoue les messages
// réels du run. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

const intent = await import("./coach-intent.ts");
const { coachSystem } = await import("./coach-prompt.ts");

// --- 1. CV clos : la réponse à une question ouverte est gardée, sans question ---

const conseil = profile("conseil-confirme-fr");
const manager = detailOf("o-conseil-manager");

/** O05, échange 2 : un fait (30 ateliers) et une question ouverte, sur un CV clos à 85. */
const O05_HISTORY = [
  { role: "assistant", content: "Ton CV est prêt : il atteint 85/100 (seuil de 80). Je n'ai plus de question à te poser." },
  { role: "user", content: "Tu vois autre chose à changer pour cette offre ?" },
  { role: "assistant", content: "Le plus utile serait de chiffrer tes puces chez Cabinet Exemple Stratégie." },
];
const O05_REQUEST =
  "Merci pour les pistes. Pour l'atelier de cadrage, je peux dire que j'ai animé plus de 30 ateliers de cadrage avec des directions générales. Pour les diagnostics chez Cabinet Exemple Stratégie et les recommandations, je ne dispose pas de chiffres précis, donc je ne peux pas inventer de résultats. Est-ce que tu peux me dire comment les formuler sans chiffres inventés ? Sinon, je pense que ça me va pour l'instant.";
const O05_ANSWER =
  "Sans chiffre, précise plutôt le périmètre : le type de clients (ETI de la distribution) et à qui tu présentais tes recommandations (comités exécutifs), c'est déjà concret.";
const ateliers = (message) =>
  flat({
    section: "experience",
    change_summary: "C'est fait : j'ai précisé ta puce sur les ateliers de cadrage.",
    message,
    data: JSON.stringify({ id: "cc-e1", bullets: [{ index: 2, after: "Animation de plus de 30 ateliers de cadrage avec des directions générales" }] }),
  });

test("question ouverte : détectée seulement pour une vraie question ouverte", () => {
  assert.equal(intent.listeningState(O05_HISTORY, O05_REQUEST).openQuestion, true);
  for (const message of ["Tu me conseilles de les mettre dans l'accroche ?", "Qu'en penses-tu ?", "Est-ce qu'il vaut mieux garder cette puce ?", "How should I phrase it?", "Which one is better?"]) {
    assert.equal(intent.listeningState([], message).openQuestion, true, message);
  }
});

test("question ouverte : non-déclenchement (prêt ?, que reste-t-il ?, confirmation, aide générale, sans « ? »)", () => {
  for (const message of [
    "Est-ce que mon CV est prêt ?",
    "Tu vois autre chose à changer pour cette offre ?",
    "Peux-tu confirmer que la puce est ajoutée ?",
    "Can you help me improve my CV please?",
    "Merci",
    "Je ne sais pas comment le dire, je préfère laisser comme ça.",
    "Aide-moi à améliorer mon CV.",
  ]) {
    assert.ok(!("openQuestion" in intent.listeningState([], message)), message);
  }
});

test("O05 rejoué : sur un CV clos, l'annonce, la réponse du modèle et le score sont affichés", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers(O05_ANSWER));
  assert.ok(result.text.startsWith("C'est fait : « Animation de plus de 30 ateliers de cadrage"), result.text);
  assert.ok(result.text.includes(O05_ANSWER), result.text);
  assert.ok(/Ton CV est (prêt : il atteint|à) \d+\/100/.test(result.text), result.text);
  assert.ok(!result.text.includes("?"), result.text);
});

/** Contexte d'O05 avec le score du run (85, CV clos). */
const closedContext = (request) => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request });
  return { ...context, score: { ...context.score, value: 85 } };
};

test("O05 rejoué : le prompt demande de répondre à la question, sans question, sur un CV clos", () => {
  const context = closedContext(O05_REQUEST);
  assert.ok(coachSystem(context, "").includes("Le candidat te pose une question : réponds-y dans « message »"));
});

test("CV clos, question ouverte : un message du modèle avec « ? » reste retiré", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers("Tu peux préciser le type de clients. Veux-tu que je le fasse ?"));
  assert.ok(!result.text.includes("?"), result.text);
  assert.ok(!result.text.includes("Tu peux préciser le type de clients"), result.text);
});

test("CV clos, question ouverte : « Dis-moi si tu veux une modification précise » n'est pas reprise", async () => {
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request: O05_REQUEST });
  const result = await turn(conseil, context, O05_HISTORY, O05_REQUEST, ateliers("Dis-moi si tu veux une modification précise."));
  assert.ok(!result.text.includes("Dis-moi si"), result.text);
});

test("CV clos, « Merci » seul : texte inchangé (annonce et score)", async () => {
  const request = "Merci, j'ai animé plus de 30 ateliers de cadrage avec des directions générales.";
  const context = contextFor(conseil, manager, { history: O05_HISTORY, request });
  assert.ok(!("openQuestion" in context.listening));
  assert.ok(!coachSystem(closedContext(request), "").includes("Le candidat te pose une question"));
  const result = await turn(conseil, context, O05_HISTORY, request, ateliers("Dis-moi si tu veux une modification précise."));
  // Texte de main : annonce, puis clôture (ou score), sans le message du modèle.
  assert.match(result.text, /^C'est fait : « Animation de plus de 30 ateliers de cadrage avec des directions générales » — Consultant senior chez Cabinet Conseil Fictif \(puce 3\)\. Ton CV est (prêt : il atteint|à) \d+\/100/);
  assert.ok(!result.text.includes("Dis-moi si"), result.text);
});

test("CV pas encore clos, question ouverte : pas de consigne ajoutée, texte habituel", async () => {
  const cv = profile("tech-stage-fr");
  const request = "Tu me conseilles de mettre l'API dans l'accroche ?";
  const context = contextFor(cv, null, { history: [], request });
  assert.ok(!coachSystem(context, "").includes("Le candidat te pose une question"));
  const result = await turn(cv, context, [], request, flat({ message: "Oui, l'accroche est le bon endroit. Veux-tu que je l'y ajoute ?" }));
  assert.equal(result.text, "Oui, l'accroche est le bon endroit. Veux-tu que je l'y ajoute ?");
});

// --- 2. Un chiffre donné avec un doute garde son approximation ---

const techStage = profile("tech-stage-fr");
const commercial = profile("commercial-junior-fr");
const techEn = profile("tech-confirme-en");

/** L02, échange 3 : rythme et durée des réunions donnés avec un doute. */
const L02_REQUEST =
  "Ah parfait, merci pour le coup de main ! Pour les réunions d'équipe, je crois que c'était plutôt des points quotidiens le matin, de quinze minutes environ, mais honnêtement je ne suis pas certain du rythme exact, ça changeait parfois selon les semaines. Je n'ai pas vraiment présenté de sujets moi-même, j'écoutais surtout et je posais des questions quand je bloquais sur un bug, ce qui me permettait de rattraper vite ce que je ne connaissais pas. Je ne sais pas si ça vaut le coup de le mettre dans le CV, mais je me suis pas mal investi dans la discussion sur les tickets à prendre. Est-ce qu'il vaut mieux garder cette puce en l'état, ou la reformuler autour de la collaboration ?";
const L02_HISTORY = [{ role: "assistant", content: "Pour ta puce « Participation aux réunions d'équipe », à quel rythme avaient-elles lieu ?" }];

/** Réponse du modèle qui réécrit une puce (expérience, index), en mode parcours. */
const bullet = (id, index, after, mode = "parcours") =>
  flat({ mode, section: "experience", change_summary: "C'est fait.", message: "", data: JSON.stringify({ id, bullets: [{ index, after }] }) });
const play = (cv, history, request, reply) => turn(cv, contextFor(cv, null, { history, request }), history, request, reply);

test("L02 rejoué : « de quinze minutes environ » écrit « de 15 minutes » est refusé, puce laissée telle quelle", async () => {
  const result = await play(techStage, L02_HISTORY, L02_REQUEST, bullet("ts-e1", 1, "Participation aux points d'équipe quotidiens de 15 minutes et à la sélection des tickets à prendre"));
  assert.equal(result.applied, 0, result.text);
  assert.equal(result.updated.experiences[0].bullets[1], "Participation aux réunions d'équipe");
  assert.ok(result.text.includes("tu m'as donné ce chiffre avec un doute, je laisse donc la puce telle quelle"), result.text);
});

test("chiffre avec un doute : accepté quand la puce garde l'approximation", async () => {
  for (const after of [
    "Participation aux points d'équipe quotidiens d'environ 15 minutes et à la sélection des tickets à prendre",
    "Participation aux points d'équipe quotidiens de 15 minutes environ et à la sélection des tickets à prendre",
    "Participation à une quinzaine de minutes de point d'équipe quotidien et à la sélection des tickets",
  ]) {
    const result = await play(techStage, L02_HISTORY, L02_REQUEST, bullet("ts-e1", 1, after));
    assert.equal(result.applied, 1, `${after} → ${result.text}`);
  }
});

test("chiffre avec un doute : non-déclenchement (autre proposition, loin, année, déjà dans le CV, sans doute)", async () => {
  for (const [request, after] of [
    // Doute dans une autre proposition (virgule) : le nombre est sûr.
    ["Je suis 80 clients actifs, et je crois que c'était en juin.", "Suivi d'un portefeuille de 80 clients actifs"],
    // « mais » entre le nombre et le doute.
    ["Je suis 80 clients actifs mais je ne suis pas certain du mois.", "Suivi d'un portefeuille de 80 clients actifs"],
    // Doute à plus de 4 mots du nombre, dans la même proposition.
    ["Je crois que dans la boutique du centre commercial nous suivions 80 clients actifs.", "Suivi d'un portefeuille de 80 clients actifs"],
    // Aucun doute.
    ["Je suis 80 clients actifs.", "Suivi d'un portefeuille de 80 clients actifs"],
    // « Je ne sais pas » est un refus, pas un doute ; le chiffre donné ensuite est sûr.
    ["Je ne sais pas pour le chiffre d'affaires. Je suis 80 clients actifs.", "Suivi d'un portefeuille de 80 clients actifs"],
  ]) {
    const result = await play(commercial, [], request, bullet("cj-e1", 2, after));
    assert.equal(result.applied, 1, `${request} → ${result.text}`);
  }
  // Année donnée avec un doute : une date n'est pas un chiffre de résultat.
  const year = await play(commercial, [], "C'était en 2023 je crois, j'y suivais 80 clients.", bullet("cj-e1", 2, "Suivi d'un portefeuille de 80 clients actifs depuis 2023"));
  assert.equal(year.applied, 1, year.text);
  // Nombre déjà dans la puce d'origine : pas concerné.
  const kept = await play(techStage, L02_HISTORY, "Je crois que c'était environ 2 pages, oui.", bullet("ts-e1", 2, "Développement de 2 nouvelles pages en React connectées à une API"));
  assert.equal(kept.applied, 1, kept.text);
});

test("chiffre avec un doute : CV en anglais, refus et message du serveur en anglais", async () => {
  const request = "I mentored about 4 junior engineers I think, over two years.";
  const refused = await play(techEn, [], request, bullet("te-e1", 2, "Mentored 4 junior engineers over two years"));
  assert.equal(refused.applied, 0, refused.text);
  assert.ok(refused.text.includes("you gave me this number with some doubt, so I'm leaving the bullet as it is"), refused.text);
  for (const after of ["Mentored about 4 junior engineers over two years", "Mentored around 4 junior engineers over two years", "Mentored roughly 4 junior engineers over two years"]) {
    const result = await play(techEn, [], request, bullet("te-e1", 2, after));
    assert.equal(result.applied, 1, `${after} → ${result.text}`);
  }
});

test("chiffre avec un doute : non-déclenchement sur le CV en anglais (doute ailleurs, aucun doute)", async () => {
  for (const request of ["I mentored 4 junior engineers, I think it was in 2021.", "I mentored 4 junior engineers.", "I mentored 4 junior engineers but I'm not sure about the dates."]) {
    const result = await play(techEn, [], request, bullet("te-e1", 2, "Mentored 4 junior engineers"));
    assert.equal(result.applied, 1, `${request} → ${result.text}`);
  }
});

test("doute exprimé : consigne de situation seulement quand le candidat doute", () => {
  assert.equal(intent.listeningState(L02_HISTORY, L02_REQUEST).uncertain, true);
  assert.equal(intent.listeningState([], "I mentored about 4 engineers I think.").uncertain, true);
  const context = contextFor(techStage, null, { history: L02_HISTORY, request: L02_REQUEST });
  assert.ok(coachSystem(context, "").includes("Le candidat exprime un doute"));
});

test("doute exprimé : non-déclenchement (opinion, refus, aide générale, anglais courant)", () => {
  for (const message of [
    "Sinon, je pense que ça me va pour l'instant.",
    "Je ne sais pas.",
    "Aide-moi à améliorer mon CV.",
    "Can you help me improve my CV please?",
    "Tell me about the summary.",
    "Je suis 80 clients actifs.",
  ]) {
    assert.ok(!("uncertain" in intent.listeningState([], message)), message);
  }
});

test("nombres douteux : même proposition et 4 mots au plus (phrases exactes)", async () => {
  const { doubtfulNumbers } = await import("./coach-proposals.ts");
  assert.deepEqual([...doubtfulNumbers(["j'ai 80 clients actifs, et je crois que c'était en juin"])], []);
  assert.deepEqual([...doubtfulNumbers(["j'ai 80 clients actifs mais je ne suis pas certain du mois"])], []);
  assert.deepEqual([...doubtfulNumbers(["de quinze minutes environ"])], ["15"]);
  assert.deepEqual([...doubtfulNumbers(["je crois qu'on était 12"])], ["12"]);
  // Doute à 5 mots du nombre : hors fenêtre.
  assert.deepEqual([...doubtfulNumbers(["je crois que dans la grande équipe 12 personnes"])], []);
  // Donné aussi sans doute ailleurs : sûr.
  assert.deepEqual([...doubtfulNumbers(["environ 12 je crois", "Oui, c'est bien 12."])], []);
});

// --- 3. « je / mon / mes » refusés dans l'accroche, les puces et les projets ---

/** L02, échange 4 : accroche réécrite par le coach en mode parcours, avec « mon ». */
const L02_SUMMARY =
  "Étudiant en informatique en dernière année d'école d'ingénieurs, à la recherche d'un stage de fin d'études en développement web. Maîtrise de JavaScript, React, TypeScript, Git et des bases de Docker. Développement d'une API REST en Node.js pour mon projet de fin d'études, utilisée par 3 équipes de l'école.";
const L02_SUMMARY_REQUEST =
  "Alors pour l'accroche, je maîtrise surtout JavaScript, React, TypeScript, Git et les bases de Docker, et côté projet j'ai développé une API REST en Node.js pour mon projet de fin d'études, utilisée par 3 équipes de mon école.";
const summary = (data, mode = "parcours") => flat({ mode, section: "summary", change_summary: "C'est fait : accroche réécrite.", message: "", data });
const PRONOUN_CAUSE = "le texte proposé parlait de toi à la première personne (« je », « mon », « mes »)";

test("L02 rejoué : accroche avec « mon » refusée en mode parcours, acceptée sans", async () => {
  const refused = await play(techStage, [], L02_SUMMARY_REQUEST, summary(L02_SUMMARY));
  assert.equal(refused.applied, 0, refused.text);
  assert.ok(refused.text.toLowerCase().includes(PRONOUN_CAUSE), refused.text);
  const accepted = await play(techStage, [], L02_SUMMARY_REQUEST, summary(L02_SUMMARY.replace("pour mon projet", "pour le projet")));
  assert.equal(accepted.applied, 1, accepted.text);
});

test("première personne : mode parcours, refus aussi dans une puce et un projet", async () => {
  const bulletWithMy = await play(techStage, [], "J'ai corrigé une vingtaine de bugs avec mon équipe.", bullet("ts-e1", 0, "Correction d'une vingtaine de bugs avec mon équipe"));
  assert.equal(bulletWithMy.applied, 0, bulletWithMy.text);
  const project = await play(
    techStage,
    [],
    "Mon appli de covoiturage a eu 150 utilisateurs.",
    flat({ section: "projects", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-p1", description: "Application mobile que j'ai lancée pour 150 étudiants de l'école." }) }),
  );
  assert.equal(project.applied, 0, project.text);
});

test("première personne : mode demande, refus sauf si le candidat demande la première personne", async () => {
  const refused = await play(techStage, [], "Reformule mon accroche, s'il te plaît.", summary("Je cherche un stage de fin d'études en développement web.", "demande"));
  assert.equal(refused.applied, 0, refused.text);
  for (const request of FIRST_PERSON_REQUESTS) {
    const result = await play(techStage, [], request, summary("Je cherche un stage de fin d'études en développement web.", "demande"));
    assert.equal(result.applied, 1, `${request} → ${result.text}`);
  }
});

/** Formulations reconnues comme une demande de première personne (FR et EN). */
const FIRST_PERSON_REQUESTS = [
  "Peux-tu me proposer une accroche qui reste à la première personne ?",
  "Écris mon accroche à la 1re personne.",
  "Garde le « je » dans mon accroche.",
  "Utilise « je » dans l'accroche, c'est plus naturel.",
  "Réécris-la avec des « je » et des « mon ».",
  "Écris-la en disant « je ».",
  "Keep my summary in the first person.",
  "Write it in first-person please.",
  "Keep the \"I\" in my summary.",
  "Use \"I\" and \"my\" in the summary.",
];

test("première personne : non-déclenchement (citation, nom propre déjà présent, intérêts, anglais, sans pronom)", async () => {
  // Citation entre guillemets.
  const quoted = await play(techStage, [], "Ajoute le nom de l'appli.", flat({ section: "projects", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-p1", description: "Application « Mon Covoit » pour 150 étudiants de l'école." }) }));
  assert.equal(quoted.applied, 1, quoted.text);
  // Nom propre déjà présent dans le CV.
  const named = { ...techStage, projects: [{ ...techStage.projects[0], name: "Mon Covoit Étudiant" }] };
  const proper = await play(named, [], "Précise la description.", flat({ section: "projects", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-p1", description: "Application Mon Covoit Étudiant utilisée par 150 étudiants de l'école." }) }));
  assert.equal(proper.applied, 1, proper.text);
  // Centres d'intérêt : section non vérifiée.
  const interests = await play(techStage, [], "Ajoute mes centres d'intérêt : course à pied.", flat({ mode: "demande", section: "interests", change_summary: "C'est fait.", data: "Course à pied avec mon club" }));
  assert.equal(interests.applied, 1, interests.text);
  // CV en anglais : « I / my » ne sont pas visés (le score ne les compte pas).
  const english = await play(techEn, [], "Rewrite my summary.", summary("I build APIs and distributed systems; my focus is B2B products, with 8 years of experience.", "demande"));
  assert.equal(english.applied, 1, english.text);
  // Accroche sans pronom.
  const clean = await play(techStage, [], L02_SUMMARY_REQUEST, summary("Étudiant en informatique à la recherche d'un stage de fin d'études en développement web."));
  assert.equal(clean.applied, 1, clean.text);
});
