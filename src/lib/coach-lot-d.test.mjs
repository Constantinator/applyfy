// Lot D du coach (runs 2026-11-16T02-55-59 et 2026-11-16T03-20-31) : poste visé d'un CV lié,
// question de suite « sans chiffre », réponse « prêt ? », puce sans chiffre après une question qui
// n'en demandait pas, niveau gonflé. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, detailOf, flat, profile, turn } from "./coach-test-fixtures.mjs";

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

// --- 4. Puce sans chiffre après une question qui n'en demandait pas (L14, tour 3) ---


const { PROBLEM_NO_FIGURE, PROBLEM_NO_VERB, PROBLEM_NEW_NUMBER_PREFIX } = await import("./coach-proposals.ts");
const { coachUserText } = await import("./coach-prompt.ts");

const marketing = profile("marketing-junior-fr");
const TOOLS_QUESTION =
  "C'est fait : « Création des campagnes d'e-mailing, dont la campagne de rentrée : 28 % de taux d'ouverture » — Chargée de marketing digital chez Marque Fictive (puce 2). Pour le suivi des indicateurs de performance chez Marque Fictive, quels indicateurs suis-tu concrètement (par exemple dans Google Analytics) et sur quels outils ou fréquence de reporting ?";
const TOOLS_ANSWER =
  "Je suis les indicateurs dans Google Analytics et dans Meta Business Suite pour Instagram, ainsi que dans mon CRM d'e-mailing. Pour la fréquence de reporting, je ne suis pas certaine du rythme exact, je ne peux pas te le confirmer.";
const historyWith = (question) => [
  { role: "assistant", content: "Pour tes campagnes d'e-mailing chez Marque Fictive, combien de campagnes as-tu créées ?" },
  { role: "user", content: "Ma campagne d'e-mailing de rentrée a obtenu un taux d'ouverture de 28 %." },
  { role: "assistant", content: question },
];
const KPI = "Suivi des indicateurs de performance dans Google Analytics, Meta Business Suite (Instagram) et le CRM d'e-mailing";
const kpiReply = (bullets) =>
  flat({ section: "experience", change_summary: "C'est fait.", message: "Passons à ton poste chez Agence Exemple : quels contenus rédigeais-tu ?", data: JSON.stringify({ id: "mj-e1", bullets }) });
const play = (question, answer, bullets) => {
  const history = historyWith(question);
  return turn(marketing, contextFor(marketing, null, { history, request: answer }), history, answer, kpiReply(bullets));
};

test("chiffre : question d'outils, réponse sans chiffre : la puce est écrite (L14, tour 3)", async () => {
  assert.equal(intent.figureNotAsked(historyWith(TOOLS_QUESTION), TOOLS_ANSWER), true);
  const result = await play(TOOLS_QUESTION, TOOLS_ANSWER, [{ index: 2, after: KPI }]);
  assert.equal(result.applied, 1, JSON.stringify(result.problems));
  assert.equal(result.updated.experiences[0].bullets[2], KPI);
  assert.ok(!result.text.includes("il me manque un chiffre"), result.text);
});

test("chiffre : une question de détail (sans mot de chiffre) compte comme une question d'outil", () => {
  assert.equal(intent.figureNotAsked(historyWith("Pour cet événement, quelles tâches as-tu assurées ?"), "J'ai géré le planning."), true);
  assert.equal(intent.figureNotAsked(historyWith("Which tools did you use for reporting?"), "Google Analytics."), true);
});

test("chiffre : non-déclenchement (question de chiffre, taux, mixte, refus, sans question)", async () => {
  for (const question of [
    "Combien de campagnes as-tu créées ?",
    "Quel était le taux d'ouverture de ta campagne ?",
    "Combien de campagnes as-tu créées, et avec quels outils ?",
    "Quels outils utilisais-tu ? Et quel budget gérais-tu ?",
    "How many campaigns did you run?",
  ]) {
    assert.equal(intent.figureNotAsked(historyWith(question), TOOLS_ANSWER), false, question);
    const refused = await play(question, TOOLS_ANSWER, [{ index: 2, after: KPI }]);
    assert.equal(refused.applied, 0, question);
    assert.ok(refused.problems.some((p) => p.problems.includes(PROBLEM_NO_FIGURE)), question);
  }
  assert.equal(intent.figureNotAsked(historyWith(TOOLS_QUESTION), "Je ne sais pas."), false, "refus : point abandonné");
  assert.equal(intent.figureNotAsked(historyWith("C'est fait."), TOOLS_ANSWER), false, "pas de question");
  assert.equal(intent.figureNotAsked([], TOOLS_ANSWER), false);
});

test("chiffre : après une question d'outils, verbe exigé, aucun nombre inventé, une seule puce sans chiffre", async () => {
  const invented = await play(TOOLS_QUESTION, TOOLS_ANSWER, [{ index: 2, after: "Suivi des indicateurs de performance dans 3 outils" }]);
  assert.equal(invented.applied, 0);
  assert.ok(invented.problems.some((p) => p.problems.some((x) => x.startsWith(PROBLEM_NEW_NUMBER_PREFIX))), JSON.stringify(invented.problems));
  const noVerb = await play(TOOLS_QUESTION, TOOLS_ANSWER, [{ index: 2, after: "Google Analytics, Meta Business Suite et CRM d'e-mailing" }]);
  assert.equal(noVerb.applied, 0);
  assert.ok(noVerb.problems.some((p) => p.problems.includes(PROBLEM_NO_VERB)), JSON.stringify(noVerb.problems));
  const two = await play(TOOLS_QUESTION, TOOLS_ANSWER, [
    { index: 2, after: KPI },
    { index: -1, after: "Suivi du CRM d'e-mailing de la marque" },
  ]);
  assert.equal(two.applied, 1, "la seconde puce sans chiffre est refusée");
  assert.ok(two.problems.some((p) => p.problems.includes(PROBLEM_NO_FIGURE)));
});

test("chiffre : mode demande inchangé (puce nouvelle sans chiffre déjà permise, verbe exigé)", async () => {
  const history = historyWith("Combien de campagnes as-tu créées ?");
  const request = "Ajoute une puce sur le suivi des indicateurs dans Google Analytics.";
  const reply = flat({ mode: "demande", section: "experience", change_summary: "C'est fait.", data: JSON.stringify({ id: "mj-e1", bullets: [{ index: -1, after: "Suivi des indicateurs dans Google Analytics" }] }) });
  const result = await turn(marketing, contextFor(marketing, null, { history, request }), history, request, reply);
  assert.equal(result.applied, 1);
});

test("second essai : phrase neutre, juste pour noFigure comme pour une question sans chiffre", () => {
  const retry = { previous: { section: "experience", data: "{}" }, problems: [{ text: "x", problems: ["y"] }], mode: "parcours", figureWaived: true };
  const text = coachUserText([], "Je ne connais pas le budget. Je gérais le planning.", retry);
  assert.ok(text.includes("Pour ce point, une seule puce peut rester sans chiffre, avec les seuls faits donnés par le candidat."));
  assert.ok(text.includes("N'ajoute AUCUN nombre absent du CV et des messages du candidat, et ne demande pas de chiffre pour cette puce."));
  assert.ok(!text.includes("Le candidat a dit ne pas avoir le chiffre"), "faux après une question d'outils");
  assert.ok(!text.includes("termine ton message par une question précise pour obtenir ce chiffre"));
});

// --- 5. Niveau gonflé (« Maîtrise de React » alors que le candidat dit « je connais ») ---

const { PROBLEM_INFLATED_LEVEL } = await import("./coach-proposals.ts");

const tech = profile("tech-stage-fr");
const finance = profile("finance-junior-fr");
const SUMMARY_Q = "Passons à ton accroche : quel type de projet web aimerais-tu réaliser, et avec quelles technologies ?";
const L02_ANSWER =
  "J'aimerais travailler sur une application web complète. Côté technologies, je connais React, TypeScript, Git et les bases de Docker. Est-ce que tu peux me proposer une formulation sobre ?";
const summaryReply = (text, mode = "parcours") => flat({ mode, section: "summary", change_summary: "C'est fait.", message: "", data: text });
const summaryTurn = (cv, history, request, text, mode, detail = null) =>
  turn(cv, contextFor(cv, detail, { history, request }), history, request, summaryReply(text, mode));
const hasLevel = (result) => result.problems.some((p) => p.problems.includes(PROBLEM_INFLATED_LEVEL));

test("niveau : « Maîtrise de React… » refusée quand le candidat dit « je connais » (L02, run du 16/11 03-20)", async () => {
  const history = [{ role: "assistant", content: SUMMARY_Q }];
  const inflated = await summaryTurn(tech, history, L02_ANSWER, "Étudiant en informatique, à la recherche d'un stage de fin d'études en développement web. Maîtrise de React, TypeScript, Git et bases de Docker.");
  assert.equal(inflated.applied, 0);
  assert.ok(hasLevel(inflated), JSON.stringify(inflated.problems));
  assert.ok(inflated.text.includes("un niveau que tu n'as pas dit"), inflated.text);
  // Les mots du candidat : écrit.
  const plain = await summaryTurn(tech, history, L02_ANSWER, "Étudiant en informatique, à la recherche d'un stage de fin d'études en développement web. Connaissance de React, TypeScript, Git et bases de Docker.");
  assert.equal(plain.applied, 1, JSON.stringify(plain.problems));
  // Anglais et autres familles : refusés aussi.
  for (const text of ["Computer science student with advanced React skills.", "Développeur expert en React.", "Étudiant expérimenté en développement web."]) {
    assert.ok(hasLevel(await summaryTurn(tech, history, L02_ANSWER, text)), text);
  }
});

test("niveau : refusé aussi en mode demande, et l'offre n'est pas une source", async () => {
  const request = "Réécris mon accroche : je connais React et TypeScript.";
  const demande = await summaryTurn(tech, [], request, "Étudiant en informatique : maîtrise de React et TypeScript.", "demande");
  assert.ok(hasLevel(demande), JSON.stringify(demande.problems));
  // CV lié à une offre qui demande la « maîtrise d'Excel » : toujours refusé.
  const linked = await summaryTurn(tech, [], request, "Étudiant en informatique : maîtrise de React et TypeScript.", "demande", detailOf("o-finance-analyste"));
  assert.ok(hasLevel(linked), JSON.stringify(linked.problems));
});

test("niveau : non-déclenchement (mots du candidat, CV, traduction, avancement, expert-comptable, titre)", async () => {
  // Le candidat dit « je maîtrise » (L11, O01) : écrit.
  const said = await summaryTurn(finance, [], "Réécris mon accroche, je maîtrise Excel avancé (tableaux croisés, macros simples).", "Analyste financière junior : maîtrise d'Excel avancé (tableaux croisés dynamiques, macros simples).", "demande");
  assert.ok(!hasLevel(said), JSON.stringify(said.problems));
  // « Excel » déjà au niveau avancé dans le CV : « Excel avancé » permis.
  const fromCv = await summaryTurn(finance, [], "Réécris mon accroche.", "Analyste financière junior, Excel avancé, première expérience en banque et en audit.", "demande");
  assert.ok(!hasLevel(fromCv), JSON.stringify(fromCv.problems));
  // Traduction : « Excel avancé » du CV → « advanced Excel ».
  const french = { ...finance, summary: "Analyste financière junior, Excel avancé.", skills: finance.skills.map((s) => ({ ...s, level: "" })) };
  const translated = await summaryTurn(french, [], "Traduis mon accroche en anglais.", "Junior financial analyst, advanced Excel.", "demande");
  assert.ok(!hasLevel(translated), JSON.stringify(translated.problems));
  // Même famille déjà dans le texte d'origine, pas plus d'occurrences : permis.
  const kept = { ...tech, summary: "Étudiant en informatique, maîtrise de React." };
  const shorter = await summaryTurn(kept, [], "Raccourcis mon accroche.", "Étudiant, maîtrise de React.", "demande");
  assert.ok(!hasLevel(shorter), JSON.stringify(shorter.problems));
  // « avancement », « expert-comptable » : pas des mots de niveau.
  const history = [{ role: "assistant", content: "Pour ton stage chez Startup Exemple, sur quoi portaient les réunions d'équipe ?" }];
  const bullets = flat({
    section: "experience",
    change_summary: "C'est fait.",
    data: JSON.stringify({ id: "ts-e1", bullets: [{ index: 1, after: "Suivi de l'état d'avancement de 2 pages en React avec l'expert-comptable du client" }] }),
  });
  const request = "On faisait le point sur l'avancement des 2 pages.";
  const progress = await turn(tech, contextFor(tech, null, { history, request }), history, request, bullets);
  assert.ok(!hasLevel(progress), JSON.stringify(progress.problems));
  // Titre du CV : pas vérifié par ce contrôle.
  const title = flat({ mode: "demande", section: "personal", change_summary: "C'est fait.", data: JSON.stringify({ jobTitle: "Développeur React confirmé" }) });
  const titled = await turn(tech, contextFor(tech, null, { history: [], request: "Change mon titre." }), [], "Change mon titre.", title);
  assert.ok(!hasLevel(titled), JSON.stringify(titled.problems));
});
