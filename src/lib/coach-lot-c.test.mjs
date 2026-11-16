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

// --- 3. Mots-clés de l'offre : 4 questions au plus (serveur), 2 mots-clés par question (prompt) ---

const { detailOf } = await import("./coach-test-fixtures.mjs");
const backend = detailOf("o-tech-backend");
const KW_QUESTIONS = [
  "As-tu déjà utilisé Docker dans un projet ou pendant ton stage ?",
  "As-tu déjà travaillé avec PostgreSQL ?",
  // Git est déjà dans le CV : la question compte quand même (tous les mots-clés de l'offre).
  "As-tu déjà utilisé Git en équipe pendant ton stage ?",
  "As-tu une expérience des tests automatisés ?",
];
const kwHistory = (questions) => questions.flatMap((q) => [{ role: "assistant", content: `C'est noté. ${q}` }, { role: "user", content: "Oui, sur mon projet de fin d'études." }]);

test("mots-clés : après 4 questions du coach, keywordsDone (même pour un mot-clé déjà dans le CV)", () => {
  const h = kwHistory(KW_QUESTIONS);
  const ctx = contextFor(techStage, backend, { history: h, request: "Oui, sur mon projet de fin d'études." });
  assert.ok(!ctx.offerKeywords.includes("Git") && ctx.offerKeywordsAll.includes("Git"));
  assert.equal(ctx.listening.keywordsDone, true);
  assert.ok(coachSystem(ctx, "").includes("Tu as déjà posé 4 questions sur les mots-clés de l'offre"));
  const three = contextFor(techStage, backend, { history: kwHistory(KW_QUESTIONS.slice(0, 3)), request: "Oui." });
  assert.ok(!("keywordsDone" in three.listening));
});

test("mots-clés : non-déclenchement (CV libre, mot-clé demandé par le candidat, proposition sans question d'expérience)", () => {
  const libre = contextFor(techStage, null, { history: kwHistory(KW_QUESTIONS), request: "Oui." });
  assert.ok(!("keywordsDone" in libre.listening));
  const h = [
    ...kwHistory(KW_QUESTIONS.slice(0, 3)),
    { role: "assistant", content: "C'est fait : j'ai ajouté Docker à tes compétences, comme tu me l'as demandé." },
    { role: "user", content: "Merci." },
    { role: "assistant", content: "Veux-tu que je réécrive ton résumé en citant ton API REST en Node.js ?" },
  ];
  const ctx = contextFor(techStage, backend, { history: h, request: "Oui." });
  assert.ok(!("keywordsDone" in ctx.listening), "seules les questions d'expérience sur un mot-clé comptent");
});

test("mots-clés : question retirée au-delà du plafond, sans « j'arrête les questions »", () => {
  const listening = { stopAll: false, stopFigures: false, readiness: false, confirmation: false, refusal: false, shorten: false, stopKeywords: false, keywordsDone: true };
  const base = { mode: "parcours", lang: "fr", score: 66, scoreBefore: 66, previousCoach: [], offerKeywords: ["Node.js", "API REST", "Docker", "méthode agile"], corrections: ["4 mots-clés du métier sur 10 visés (Tech & Développement)"] };
  const kept = intent.listenText({ ...base, listening, text: "C'est fait. As-tu déjà travaillé en méthode agile ?" });
  assert.equal(kept, "C'est fait.");
  const alone = intent.listenText({ ...base, listening, text: "As-tu déjà travaillé en méthode agile ?" });
  assert.equal(alone, "On passe au point suivant : 4 mots-clés du métier sur 10 visés (Tech & Développement).");
  const closed = intent.listenText({ ...base, score: 84, scoreBefore: 84, listening, text: "As-tu déjà travaillé en méthode agile ?" });
  assert.equal(closed, "Dis-moi si tu veux une modification précise.");
  // Sans plafond atteint : question gardée.
  const free = intent.listenText({ ...base, listening: { ...listening, keywordsDone: undefined }, text: "As-tu déjà travaillé en méthode agile ?" });
  assert.equal(free, "As-tu déjà travaillé en méthode agile ?");
});

test("mots-clés : au plus 2 mots-clés par question, dans les règles de l'offre seulement (CV lié)", () => {
  const linked = coachSystem(contextFor(techStage, backend), "");
  assert.ok(linked.includes("Une question cite au plus 2 mots-clés de l'offre."));
  assert.ok(!coachSystem(contextFor(techStage, null), "").includes("Une question cite au plus 2 mots-clés"));
});

// --- 2a. Seuil de gain : corrections à +1 pt retirées de la liste du coach ---

const { coachCorrections, COACH_MIN_GAIN } = await import("./coach-context.ts");

test("gain : « Dates sans mois » à +1 retirées de la liste du coach, gardées à +2", () => {
  assert.equal(COACH_MIN_GAIN, 2);
  const commercial = contextFor(profile("commercial-junior-fr"), null);
  assert.ok(!commercial.score.corrections.some((c) => c.startsWith("Dates sans mois")), commercial.score.corrections.join("\n"));
  assert.ok(commercial.score.corrections.some((c) => c.includes("(+4 pts)")));
  // CV à une seule expérience : dates à +2, gardées (et posées une seule fois, point 1).
  const rh = contextFor(profile("rh-stage-fr"), null);
  assert.ok(rh.score.corrections.some((c) => c.startsWith("Dates sans mois") && c.endsWith("(+2 pts)")));
});

test("gain : exception « score + somme des +1 ≥ 80 » (CV pas clos), et CV clos filtré", () => {
  const c = (points) => ({ id: `x${points}`, category: "form", elementId: null, message: `m${points}`, points, request: "" });
  const corrections = [c(3), c(1), c(1)];
  assert.deepEqual(coachCorrections({ score: 78, corrections }).map((x) => x.points), [3, 1, 1], "78 + 2 = 80 : gardées");
  assert.deepEqual(coachCorrections({ score: 77, corrections }).map((x) => x.points), [3], "77 + 2 < 80 : retirées");
  assert.deepEqual(coachCorrections({ score: 85, corrections }).map((x) => x.points), [3], "CV clos : retirées des pistes");
  assert.deepEqual(coachCorrections({ score: 50, corrections: [c(4), c(2)] }).map((x) => x.points), [4, 2], "rien à +1 : liste inchangée");
});

test("gain : l'éditeur et la clôture du serveur gardent toutes les corrections", async () => {
  const { scoreCv } = await import("./cv-score.ts");
  const { scoringContextFrom } = await import("./cv-scoring-context.ts");
  const cv = profile("commercial-junior-fr");
  const full = scoreCv(cv, scoringContextFrom(cv, null, []));
  assert.ok(full.corrections.some((x) => x.message.startsWith("Dates sans mois") && x.points === 1));
});

// --- Banc d'essai : mesures du lot C ---

const evalMetrics = await import("../../scripts/eval/metrics.ts");

/** Enregistrement minimal d'une conversation du banc d'essai (CV inchangé). */
function record(cv, opening, exchanges, offer = null) {
  return {
    scenarioId: "X",
    case: offer ? "lie" : "libre",
    repeat: 0,
    language: "fr",
    sectorStart: "tech",
    startScore: 60,
    endScore: 60,
    startCv: cv,
    endCv: cv,
    opening,
    offer,
    judge: null,
    endReason: "fin",
    turns: exchanges.map(([user, coachText]) => ({
      user,
      coachText,
      error: null,
      mode: "parcours",
      scoreBefore: 60,
      scoreAfter: 60,
      applied: 0,
      retried: false,
      problems: [],
      firstProblems: [],
      claim: null,
      unchangedQuoted: [],
      skipped: [],
      section: null,
      offerGap: "",
    })),
  };
}
const scenario = { id: "X", case: "libre", expectedSector: "tech" };

test("banc d'essai : questions de mois et phrase « projet d'école » comptées", () => {
  const m = evalMetrics.computeMetrics(
    record(techStage, MONTH_Q, [
      ["Juin à août.", `C'est fait. ${SCHOOL_FR} Et à quel mois as-tu commencé ton projet ?`],
      ["Je ne sais pas.", "Combien de dossiers traitais-tu par mois ?"],
    ]),
    scenario,
  );
  assert.equal(m.monthQuestions, 2, "l'ouverture et le 1er message ; « par mois » ne compte pas");
  assert.equal(m.schoolProjectPhrases, 1);
});

test("banc d'essai : questions sur les mots-clés de l'offre et mots-clés par question", () => {
  const offer = { steps: [], keywords: ["Node.js", "API REST", "Docker", "PostgreSQL"], languageNote: false, gap: null };
  const m = evalMetrics.computeMetrics(
    record(techStage, "As-tu déjà utilisé Docker ?", [
      ["Oui.", "As-tu déjà travaillé avec PostgreSQL, Docker et Node.js ?"],
      ["Non.", "Veux-tu que je réécrive ton résumé en citant ton API REST en Node.js ?"],
    ], offer),
    { ...scenario, case: "lie" },
  );
  assert.equal(m.offerFlow.keywordQuestions, 2, "la proposition de résumé n'est pas une question d'expérience");
  assert.equal(m.offerFlow.keywordsPerQuestionMax, 3);
});

// --- Suite du run 2026-11-16T02-55-59 : 1. Marqueurs d'hésitation refusés (L02, tour 3) ---

const { PROBLEM_HESITATION } = await import("./coach-proposals.ts");
const { coachBuilderCv } = await import("./coach-llm.ts");
const { runCoachTurn } = await import("./coach-turn.ts");
const { quiet } = await import("./coach-test-fixtures.mjs");
/** Client factice : première réponse, puis seconde réponse pour le nouvel essai. */
const fakeClient = (pick) => ({
  beta: { messages: { parse: async (params) => ({ stop_reason: "end_turn", parsed_output: pick(++fakeClient.calls), model: params.model }) } },
});

const L02_PAGES_REQUEST =
  "Alors pour les deux pages en React, c'étaient une page de liste et une page de détail, enfin je crois, parce que je ne me souviens plus très bien des noms exacts. Pour la version de React, je ne sais pas trop, je pense que c'était la version utilisée par le projet. Ce qui est sûr, c'est que j'ai surtout appris à découper les composants et à gérer l'état entre les pages. Est-ce que je peux écrire ça sans inventer la version ni les noms des pages ?";
const L02_HISTORY = [{ role: "assistant", content: "Passons à ta puce « Développement de 2 nouvelles pages en React » chez Startup Exemple : quelles pages as-tu développées, et quelle version de React as-tu utilisée ?" }];
const L02_WRITTEN = "Développement de 2 nouvelles pages en React (une page de liste et une page de détail, il me semble) : découpage en composants et gestion de l'état entre les pages";
const L02_CLEAN = "Développement de 2 nouvelles pages en React : découpage en composants et gestion de l'état entre les pages";
const pageBullet = (after) =>
  flat({ section: "experience", change_summary: "C'est fait.", message: "Quels sont les mois de début et de fin de ton stage ?", data: JSON.stringify({ id: "ts-e1", bullets: [{ index: 2, after }] }) });

/** Un échange avec un second essai différent de la première réponse. */
async function turnWithRetry(cv, context, history, request, first, second) {
  fakeClient.calls = 0;
  const client = fakeClient((n) => (n === 1 ? first : second));
  const reply = await coachBuilderCv(client, context, history, request);
  return quiet(() =>
    runCoachTurn({ current: cv, context, turns: history, request, reply, limitReached: false, retry: (retry) => coachBuilderCv(client, context, history, request, retry) }),
  );
}

test("hésitation : L02, « il me semble » refusé au premier essai, la version sûre est écrite au second", async () => {
  const context = contextFor(techStage, null, { history: L02_HISTORY, request: L02_PAGES_REQUEST });
  const result = await turnWithRetry(techStage, context, L02_HISTORY, L02_PAGES_REQUEST, pageBullet(L02_WRITTEN), pageBullet(L02_CLEAN));
  assert.ok(result.firstProblems.some((p) => p.problems.includes(PROBLEM_HESITATION)));
  assert.equal(result.retried, true);
  assert.equal(result.updated.experiences[0].bullets[2], L02_CLEAN);
  // Encore refusé au second essai : rien n'est écrit, et le candidat le sait.
  const twice = await turnWithRetry(techStage, context, L02_HISTORY, L02_PAGES_REQUEST, pageBullet(L02_WRITTEN), pageBullet(L02_WRITTEN));
  assert.equal(twice.applied, 0);
  assert.equal(twice.updated.experiences[0].bullets[2], "Développement de 2 nouvelles pages en React");
  assert.ok(twice.text.includes("n'a pas sa place dans un CV : je n'ai pas écrit ce passage."), twice.text);
});

test("hésitation : déclenchement en anglais, en mode demande, dans l'accroche", async () => {
  const cases = [
    ["Built 2 React pages, I think, for the web app", "parcours"],
    ["Gestion de 3 projets, peut-être 4, pour l'équipe produit", "demande"],
    ["Développement de 2 pages en React, probably for the dashboard", "demande"],
  ];
  for (const [after, mode] of cases) {
    const context = contextFor(techStage, null, { history: L02_HISTORY, request: "Ajoute une puce." });
    const result = await turn(techStage, context, L02_HISTORY, "Ajoute une puce.", { ...pageBullet(after), mode });
    assert.ok(result.firstProblems.some((p) => p.problems.includes(PROBLEM_HESITATION)), after);
  }
  const summary = flat({ mode: "demande", section: "summary", change_summary: "C'est fait.", data: "Étudiant en informatique, je pense orienté web, à la recherche d'un stage de fin d'études" });
  const r = await turn(techStage, contextFor(techStage, null, { request: "Reformule mon accroche." }), [], "Reformule mon accroche.", summary);
  assert.ok(r.firstProblems.some((p) => p.problems.includes(PROBLEM_HESITATION)));
});

test("hésitation : non-déclenchement (approximations, citation, marqueur déjà présent, « Pensée design », anglais sans marqueur)", async () => {
  const ok = [
    "Correction d'environ 20 bugs sur l'application web",
    "Correction d'une vingtaine de bugs sur l'application web",
    "Fixed about 20 bugs on the web app",
    "Animation de points quotidiens d'environ 15 minutes",
    "Animation d'un atelier « je pense donc je code » pour 2 équipes",
    "Pensée design appliquée à 2 nouvelles pages en React",
  ];
  for (const after of ok) {
    const context = contextFor(techStage, null, { history: L02_HISTORY, request: "Une vingtaine, 20 bugs, 15 minutes, 2 équipes." });
    const result = await turn(techStage, context, L02_HISTORY, "Une vingtaine, 20 bugs, 15 minutes, 2 équipes.", pageBullet(after));
    assert.ok(!result.firstProblems.some((p) => p.problems.includes(PROBLEM_HESITATION)), `${after} : ${JSON.stringify(result.firstProblems)}`);
  }
  // Marqueur déjà dans le texte d'origine (mode demande) : toléré.
  const cv = { ...techStage, experiences: [{ ...techStage.experiences[0], bullets: ["Développement de 2 pages en React, il me semble", ...techStage.experiences[0].bullets.slice(1)] }] };
  const kept = flat({ mode: "demande", section: "experience", change_summary: "C'est fait.", data: JSON.stringify({ id: "ts-e1", bullets: [{ index: 0, after: "Développement de 2 pages React, il me semble" }] }) });
  const result = await turn(cv, contextFor(cv, null, { request: "Raccourcis ma première puce." }), [], "Raccourcis ma première puce.", kept);
  assert.ok(!result.firstProblems.some((p) => p.problems.includes(PROBLEM_HESITATION)), JSON.stringify(result.firstProblems));
});

// --- 2. Consigne du doute : chiffre approché, autre fait non écrit, aucun marqueur dans le CV ---

const UNCERTAIN_FR =
  "Le candidat exprime un doute dans son dernier message. Un chiffre donné avec un doute garde son approximation (« environ », « une quinzaine », « plutôt »), ou n'est pas écrit. Un autre fait donné avec un doute n'est pas écrit. N'écris jamais de marqueur d'hésitation (« il me semble », « je crois », « I think ») dans le CV.";

test("doute : nouvelle consigne avec le doute (L02, tour 3), absente sans doute", () => {
  const withDoubt = coachSystem(contextFor(techStage, null, { history: L02_HISTORY, request: L02_PAGES_REQUEST }), "");
  assert.ok(withDoubt.includes(UNCERTAIN_FR));
  assert.ok(!withDoubt.includes("garde ce doute dans le texte"), "ancienne consigne retirée");
  for (const request of ["Une vingtaine de bugs.", "Aide-moi à améliorer mon CV.", "je sais pas"]) {
    const ctx = contextFor(techStage, null, { history: L02_HISTORY, request });
    assert.ok(!ctx.listening.uncertain && !coachSystem(ctx, "").includes("Le candidat exprime un doute"), request);
  }
});

const { doubtfulNumbers: doubtful } = await import("./coach-proposals.ts");

test("doute : CV en anglais, exemples anglais ; « je dirais » et « I'd say » reconnus", () => {
  const en = profile("tech-confirme-en");
  const ctx = contextFor(en, null, { history: [{ role: "assistant", content: "How many services did you migrate?" }], request: "I'd say around 12 services." });
  assert.equal(ctx.listening.uncertain, true);
  const system = coachSystem(ctx, "");
  assert.ok(system.includes("(« about », « around 15 », « roughly »)") && system.includes("(« I think », « I believe », « probably »)"));
  assert.ok(!system.includes(UNCERTAIN_FR));
  assert.equal(intent.expressesDoubt("Je dirais une quinzaine de clients."), true);
  assert.deepEqual([...doubtful(["Je dirais 15 clients par semaine."])], ["15"]);
  assert.deepEqual([...doubtful(["I'd say 12 services."])], ["12"]);
});
