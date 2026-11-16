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

// --- 4. Puce sans chiffre quand le candidat dit ne pas avoir le chiffre (L14 du 15/11) ---

const { flat, turn } = await import("./coach-test-fixtures.mjs");
const { PROBLEM_NEW_NUMBER_PREFIX, PROBLEM_NO_FIGURE } = await import("./coach-proposals.ts");
const { coachUserText } = await import("./coach-prompt.ts");

const marketing = profile("marketing-junior-fr");
const L14_QUESTION =
  "Passons à l'événement de lancement chez Agence Exemple : quel était ton rôle concret dans son organisation (budget, prestataires, planning, invitations) et quel était le type d'événement ou le client concerné ?";
const L14_HISTORY = [
  { role: "assistant", content: "Pour ton poste d'Assistante communication chez Agence Exemple, quels types de contenus as-tu rédigés ?" },
  { role: "user", content: "Surtout des posts pour les réseaux sociaux et quelques newsletters." },
  { role: "assistant", content: L14_QUESTION },
];
const L14_REQUEST =
  "Mon rôle était de gérer le planning et les invitations, en coordonnant les prestataires avec l'équipe. Je ne connais pas le budget exact, et je ne peux pas te dire le nombre de participants. C'était un événement de lancement pour un des clients de l'agence, mais je ne me souviens plus du nom du produit.";
const eventBullets = (bullets) =>
  flat({
    section: "experience",
    change_summary: "C'est fait.",
    message: "Passons à ta formation : as-tu réalisé un projet en lien avec l'événementiel ?",
    data: JSON.stringify({ id: "mj-e2", bullets }),
  });
const EVENT = "Organisation de l'événement de lancement d'un client de l'agence : gestion du planning et des invitations, coordination des prestataires";

test("chiffre : L14, le candidat donne ses faits sans chiffre : la puce est écrite, sans tour perdu", async () => {
  const context = contextFor(marketing, null, { history: L14_HISTORY, request: L14_REQUEST });
  assert.equal(context.listening.noFigure, true);
  assert.ok(coachSystem(context, "").includes("Le candidat dit ne pas avoir le chiffre demandé"));
  const result = await turn(marketing, context, L14_HISTORY, L14_REQUEST, eventBullets([{ index: 1, after: EVENT }]));
  assert.equal(result.applied, 1);
  assert.equal(result.updated.experiences[1].bullets[1], EVENT);
  assert.ok(!result.text.includes("il me manque un chiffre"), result.text);
  // Sans la dérogation (comportement d'avant) : refusée faute de chiffre.
  const before = { ...context, listening: { ...context.listening, noFigure: undefined } };
  const refused = await turn(marketing, before, L14_HISTORY, L14_REQUEST, eventBullets([{ index: 1, after: EVENT }]));
  assert.equal(refused.applied, 0);
  assert.ok(refused.problems.some((p) => p.problems.includes(PROBLEM_NO_FIGURE)));
});

test("chiffre : la dérogation n'autorise aucun nombre inventé, et une seule puce sans chiffre", async () => {
  const context = contextFor(marketing, null, { history: L14_HISTORY, request: L14_REQUEST });
  const invented = await turn(marketing, context, L14_HISTORY, L14_REQUEST, eventBullets([{ index: 1, after: "Coordination de 5 prestataires pour l'événement de lancement d'un client" }]));
  assert.equal(invented.applied, 0);
  assert.ok(invented.problems.some((p) => p.problems.some((x) => x.startsWith(PROBLEM_NEW_NUMBER_PREFIX))), JSON.stringify(invented.problems));
  const two = await turn(
    marketing,
    context,
    L14_HISTORY,
    L14_REQUEST,
    eventBullets([
      { index: 1, after: EVENT },
      { index: -1, after: "Gestion des invitations des clients de l'agence" },
    ]),
  );
  assert.equal(two.applied, 1, "la seconde puce sans chiffre est refusée");
  assert.ok(two.problems.some((p) => p.problems.includes(PROBLEM_NO_FIGURE)));
});

test("chiffre : non-déclenchement (« je sais pas », question d'outil, échange suivant, négation en tête)", () => {
  const plain = intent.listeningState(L14_HISTORY, "je sais pas");
  assert.ok(!("noFigure" in plain));
  const tool = intent.listeningState([{ role: "assistant", content: "Quel outil utilisais-tu pour les invitations ?" }], "Je gérais les invitations, je n'ai pas de chiffre.");
  assert.ok(!("noFigure" in tool), "la question ne demandait pas de chiffre");
  const next = intent.listeningState(
    [...L14_HISTORY, { role: "user", content: L14_REQUEST }, { role: "assistant", content: "C'est fait. Combien de clients suivais-tu ?" }],
    "Une dizaine de clients.",
  );
  assert.ok(!("noFigure" in next), "le chiffre est de nouveau exigé à l'échange suivant");
  const negativeFirst = intent.listeningState(L14_HISTORY, "Je ne connais pas le budget. Je gérais le planning.");
  assert.ok(!("noFigure" in negativeFirst), "réponse qui commence par un refus : point abandonné, comme avant");
  const en = intent.listeningState([{ role: "assistant", content: "How many guests attended the launch event?" }], "I managed the schedule and the invitations. I don't have the exact number of guests.");
  assert.equal(en.noFigure, true);
});

test("chiffre : le nouvel essai garde la dérogation, sans demander le chiffre", () => {
  const retry = { previous: { section: "experience", data: "{}" }, problems: [{ text: "x", problems: ["y"] }], mode: "parcours", figureWaived: true };
  const text = coachUserText([], "msg", retry);
  assert.ok(text.includes("une seule puce peut rester sans chiffre"));
  assert.ok(!text.includes("termine ton message par une question précise pour obtenir ce chiffre"));
  const usual = coachUserText([], "msg", { ...retry, figureWaived: undefined });
  assert.ok(usual.includes("termine ton message par une question précise pour obtenir ce chiffre"));
});

// --- 5. Phrase fixe « projet d'école » (O06 du 16/11) ---

const { schoolProjectBullet } = await import("./coach-turn.ts");

const SCHOOL_FR = "Si c'était un projet d'école plutôt qu'une mission de ton stage, dis-le-moi : je le mettrai dans tes projets.";
const SCHOOL_EN = "If it was a school project rather than a task from your internship, tell me: I'll put it in your projects.";
const techStage = profile("tech-stage-fr");
const O06_REQUEST = "Ajoute une puce à mon stage : j'ai développé une API REST en Node.js utilisée par 3 équipes de mon école.";
const O06_BULLET = "Développement d'une API REST en Node.js utilisée par 3 équipes de l'école";
const addBullet = (id, after, message = "Veux-tu que je réécrive ton résumé ?") =>
  flat({ mode: "demande", section: "experience", change_summary: "C'est fait.", message, data: JSON.stringify({ id, bullets: [{ index: -1, after }] }) });
const withExperience = (cv, patch) => ({ ...cv, experiences: cv.experiences.map((e, i) => (i === 0 ? { ...e, ...patch } : e)) });
const history = [{ role: "assistant", content: "Je vais t'aider à corriger ton CV point par point. Combien de bugs as-tu corrigés ?" }];

async function play(cv, request, reply, h = history) {
  return turn(cv, contextFor(cv, null, { history: h, request }), h, request, reply);
}

test("école : O06, la puce est écrite puis la phrase fixe suit l'annonce", async () => {
  const result = await play(techStage, O06_REQUEST, addBullet("ts-e1", O06_BULLET));
  assert.equal(result.applied, 1);
  assert.ok(result.text.includes(`(nouvelle puce). ${SCHOOL_FR}`), result.text);
  assert.equal(result.text.split(SCHOOL_FR).length, 2, "une seule fois");
});

test("école : CV en anglais, phrase en anglais ; jamais redite dans la session", async () => {
  const cv = withExperience(techStage, { position: "Software Engineering Intern", company: "Example Tech" });
  const request = "Add a bullet to my internship: I built a REST API used by 3 teams at my school.";
  const result = await play(cv, request, addBullet("ts-e1", "Built a REST API in Node.js used by 3 teams at the school"));
  assert.equal(result.applied, 1);
  assert.ok(result.text.includes(SCHOOL_EN), result.text);
  const again = await play(techStage, O06_REQUEST, addBullet("ts-e1", O06_BULLET), [...history, { role: "user", content: "x" }, { role: "assistant", content: `C'est fait. ${SCHOOL_FR}` }]);
  assert.equal(again.applied, 1);
  assert.ok(!again.text.includes(SCHOOL_FR), again.text);
});

test("école : CV clos, la phrase vient avant la clôture, sans question", async () => {
  const result = await play(techStage, O06_REQUEST, addBullet("ts-e1", O06_BULLET));
  const closing = result.text.indexOf("Ton CV est prêt");
  if (closing >= 0) assert.ok(result.text.indexOf(SCHOOL_FR) < closing);
  // Score forcé au-dessus du seuil : même ordre.
  const { coachReplyText } = await import("./coach-outcome.ts");
  const text = coachReplyText({
    mode: "demande", section: "experience", applied: 1, stale: 0, invalid: false, firstInvalid: false, noChange: false, problems: [], firstProblems: [],
    message: "", changeSummary: "", appliedLabels: ["x"], bulletChanges: [{ kind: "written", text: O06_BULLET, label: "Stagiaire développeur chez Startup Exemple — nouvelle puce" }],
    schoolProject: true, scoreBefore: 78, scoreAfter: 84, corrections: [], offerKeywords: [], lang: "fr",
  });
  assert.ok(text.indexOf(SCHOOL_FR) < text.indexOf("Ton CV est prêt"), text);
  assert.ok(!text.includes("?"), text);
});

test("école : non-déclenchement (alternance, CDI, université, prestataire, puce modifiée, projets, puce refusée)", async () => {
  const cases = [
    ["alternance", withExperience(techStage, { position: "Alternant développeur" }), O06_REQUEST, addBullet("ts-e1", O06_BULLET)],
    ["CDI", withExperience(techStage, { position: "Développeur" }), O06_REQUEST, addBullet("ts-e1", O06_BULLET)],
    ["stage à l'université", withExperience(techStage, { company: "Université Lyon 2" }), O06_REQUEST, addBullet("ts-e1", O06_BULLET)],
    ["stage à University of Leeds", withExperience(techStage, { position: "Intern", company: "University of Leeds" }), "Add a bullet: I built an API used by 3 teams at my university.", addBullet("ts-e1", "Built an API used by 3 teams at the university")],
    ["prestataire, école cliente", withExperience(techStage, { company: "EdTech Fictive" }), "Ajoute une puce : j'ai formé 3 équipes de l'école cliente à l'outil.", addBullet("ts-e1", "Formation de 3 équipes de l'école cliente à l'outil")],
    [
      "puce modifiée",
      techStage,
      O06_REQUEST,
      flat({ mode: "demande", section: "experience", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-e1", bullets: [{ index: 2, after: "Développement de 2 nouvelles pages en React pour l'école" }] }) }),
    ],
    [
      "projet",
      techStage,
      O06_REQUEST,
      flat({ mode: "demande", section: "projects", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-p1", description: "Application mobile pour les étudiants de l'école, utilisée par 3 équipes" }) }),
    ],
    ["puce refusée (sans verbe)", techStage, O06_REQUEST, addBullet("ts-e1", "API REST en Node.js de l'école, 3 équipes")],
  ];
  for (const [name, cv, request, reply] of cases) {
    const result = await play(cv, request, reply);
    // Chaque cas est une vraie modification (appliquée, sauf la puce refusée).
    assert.equal(result.applied, name.startsWith("puce refusée") ? 0 : 1, `${name} : ${result.text}`);
    assert.ok(!result.text.includes(SCHOOL_FR) && !result.text.includes(SCHOOL_EN), `${name} : ${result.text}`);
  }
  // Mots d'école sans « mon école » dans le message : aucun déclenchement.
  const change = { kind: "bullet", experienceId: "ts-e1", before: null, moved: false, after: O06_BULLET };
  assert.equal(schoolProjectBullet([change], techStage, O06_REQUEST), true);
  assert.equal(schoolProjectBullet([change], techStage, "Ajoute une puce : API REST en Node.js utilisée par 3 équipes."), false);
});
