// Vérification des modifications du coach selon le mode (« demande » : non-régression et nombres
// inventés ; « parcours » : règle stricte inchangée). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const {
  buildProposal,
  checkProposal,
  inventedNumbers,
  numberSources,
  withoutProblems,
  PROBLEM_BANNED_PREFIX,
  PROBLEM_LOST_FIGURE,
  PROBLEM_LOST_VERB,
  PROBLEM_NEW_NUMBER_PREFIX,
  PROBLEM_NO_FIGURE,
  PROBLEM_NO_VERB,
} = await import("./coach-proposals.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { coachReplyText, quotaBlockedText, closedOpening } = await import("./coach-outcome.ts");

const SCORING = { actionVerbs: [], avoid: [] };
const BULLETS = [
  "Gestion de la caisse et accueil des clients du magasin tous les samedis de la saison", // verbe, sans chiffre
  "Pilotage de 12 projets pour 3 clients grands comptes", // verbe et chiffre
  "Tenue du standard téléphonique", // ni verbe reconnu, ni chiffre
  "Force de proposition auprès de 40 clients", // formule à éviter déjà présente
];
const cv = CvDataSchema.parse({
  personal: { firstName: "Camille", lastName: "Martin", jobTitle: "Chargée de clientèle" },
  summary: "Chargée de clientèle dynamique, 4 ans d'expérience en agence.",
  experiences: [{ id: "e1", position: "Vendeuse", company: "Boutique X", startDate: "2021", endDate: "2023", bullets: BULLETS }],
  skills: [{ id: "s1", name: "Excel", level: "" }],
});

let counter = 0;
const proposalFor = (update) => buildProposal(cv, update, () => `id${counter++}`);
const bullets = (...list) => proposalFor({ section: "experience", data: { id: "e1", bullets: list, bullets_to_remove: [] } });
const problemsOf = (proposal, mode, candidateMessages = []) =>
  checkProposal(proposal, SCORING, cv, { mode, candidateMessages }).flatMap((p) => p.problems);

// --- Non-régression en mode demande ---

test("demande : une puce sans chiffre raccourcie est acceptée", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse et accueil des clients" });
  assert.deepEqual(problemsOf(proposal, "demande"), []);
});

test("parcours : la même puce raccourcie reste refusée faute de chiffre", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse et accueil des clients" });
  assert.deepEqual(problemsOf(proposal, "parcours"), [PROBLEM_NO_FIGURE]);
  // Sans option, le mode est « parcours » (comportement d'avant le lot D).
  assert.deepEqual(checkProposal(proposal, SCORING, cv).flatMap((p) => p.problems), [PROBLEM_NO_FIGURE]);
});

test("demande : une puce qui perd son chiffre est refusée", () => {
  const proposal = bullets({ index: 1, after: "Pilotage de projets pour des clients grands comptes" });
  assert.deepEqual(problemsOf(proposal, "demande"), [PROBLEM_LOST_FIGURE]);
});

test("demande : une puce qui garde son chiffre et son verbe est acceptée", () => {
  const proposal = bullets({ index: 1, after: "Pilotage de 12 projets grands comptes (3 clients)" });
  assert.deepEqual(problemsOf(proposal, "demande"), []);
});

test("demande : une puce qui perd son verbe d'action est refusée", () => {
  const proposal = bullets({ index: 1, after: "Responsable de 12 projets pour 3 clients grands comptes" });
  assert.deepEqual(problemsOf(proposal, "demande"), [PROBLEM_LOST_VERB]);
});

test("demande : une puce sans verbe reconnu ni chiffre peut être reformulée sans en gagner", () => {
  const proposal = bullets({ index: 2, after: "Tenue du standard" });
  assert.deepEqual(problemsOf(proposal, "demande"), []);
  assert.deepEqual(problemsOf(proposal, "parcours"), [PROBLEM_NO_VERB, PROBLEM_NO_FIGURE]);
});

test("demande : une formule à éviter déjà présente est tolérée, une formule ajoutée est refusée", () => {
  const kept = bullets({ index: 3, after: "Force de proposition pour 40 clients" });
  assert.deepEqual(problemsOf(kept, "demande"), []);
  const added = bullets({ index: 1, after: "Pilotage de 12 projets pour 3 clients, force de proposition" });
  assert.deepEqual(problemsOf(added, "demande"), [`${PROBLEM_BANNED_PREFIX}force de proposition »`]);
});

test("demande : l'accroche raccourcie n'est pas refusée pour une formule qu'elle avait déjà", () => {
  const withJargon = CvDataSchema.parse({ summary: "Profil dynamique et force de proposition, 4 ans d'expérience en agence." });
  const proposal = buildProposal(withJargon, { section: "summary", data: "Force de proposition, 4 ans d'expérience." }, () => `id${counter++}`);
  assert.deepEqual(checkProposal(proposal, SCORING, withJargon, { mode: "demande" }), []);
  assert.equal(checkProposal(proposal, SCORING, withJargon, { mode: "parcours" }).length, 1);
});

// --- Nouvelle puce demandée explicitement ---

test("demande : une nouvelle puce sans chiffre est acceptée si elle commence par un verbe d'action", () => {
  const proposal = bullets({ index: -1, after: "Gestion des retours clients" });
  assert.deepEqual(problemsOf(proposal, "demande"), []);
  assert.deepEqual(problemsOf(proposal, "parcours"), [PROBLEM_NO_FIGURE]);
});

test("demande : une nouvelle puce sans verbe d'action est refusée", () => {
  const proposal = bullets({ index: -1, after: "Responsable des retours clients" });
  assert.deepEqual(problemsOf(proposal, "demande"), [PROBLEM_NO_VERB]);
});

test("demande : une nouvelle expérience suit la même règle (verbe exigé, chiffre non)", () => {
  const proposal = proposalFor({
    section: "experience",
    data: {
      id: "",
      position: "Hôtesse",
      company: "Salon Y",
      bullets: [
        { index: -1, after: "Tenue du vestiaire des visiteurs" },
        { index: -1, after: "Gestion des badges" },
      ],
      bullets_to_remove: [],
    },
  });
  const problems = checkProposal(proposal, SCORING, cv, { mode: "demande" });
  assert.deepEqual(problems.map((p) => [p.text, p.problems]), [["Tenue du vestiaire des visiteurs", [PROBLEM_NO_VERB]]]);
  // La puce refusée est retirée, l'expérience et sa puce valide restent.
  assert.deepEqual(withoutProblems(proposal, problems).changes[0].value.bullets, ["Gestion des badges"]);
});

// --- Faits inventés ---

test("demande : un nombre absent du CV et des messages est refusé", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse pour 150 clients par jour" });
  assert.deepEqual(problemsOf(proposal, "demande"), [`${PROBLEM_NEW_NUMBER_PREFIX}150`]);
});

test("demande : un nombre donné par le candidat dans la conversation est accepté", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse pour 150 clients par jour" });
  assert.deepEqual(problemsOf(proposal, "demande", ["Raccourcis et précise que c'était 150 clients par jour"]), []);
});

test("demande : un nombre déjà ailleurs dans le CV est accepté, un nombre en lettres vaut son chiffre", () => {
  assert.deepEqual(problemsOf(bullets({ index: 0, after: "Gestion de la caisse pendant 4 ans" }), "demande"), []);
  const proposal = bullets({ index: -1, after: "Gestion de 15 dossiers" });
  assert.deepEqual(problemsOf(proposal, "demande", ["ajoute que je gérais quinze dossiers"]), []);
  assert.deepEqual(problemsOf(proposal, "demande", ["ajoute que je gérais des dossiers"]), [`${PROBLEM_NEW_NUMBER_PREFIX}15`]);
});

test("demande : un ordre de grandeur inventé est refusé", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse pour une centaine de clients" });
  assert.deepEqual(problemsOf(proposal, "demande"), [`${PROBLEM_NEW_NUMBER_PREFIX}centaine`]);
});

test("demande : un nombre inventé est refusé dans l'accroche, les compétences et le titre aussi", () => {
  const summary = proposalFor({ section: "summary", data: "Chargée de clientèle, 10 ans d'expérience en agence." });
  assert.deepEqual(problemsOf(summary, "demande"), [`${PROBLEM_NEW_NUMBER_PREFIX}10`]);
  const skills = proposalFor({ section: "skills", data: [{ name: "Excel (7 ans de pratique)", level: "" }] });
  assert.deepEqual(problemsOf(skills, "demande"), [`${PROBLEM_NEW_NUMBER_PREFIX}7`]);
  const title = proposalFor({ section: "personal", data: { jobTitle: "Chargée de clientèle senior (8 ans)" } });
  assert.deepEqual(problemsOf(title, "demande"), [`${PROBLEM_NEW_NUMBER_PREFIX}8`]);
});

test("nombres : identifiants, photo et analyse du CV ne sont pas des sources", () => {
  const withNoise = CvDataSchema.parse({
    personal: { photo: "data:image/png;base64,AAAA777" },
    experiences: [{ id: "e777", position: "Vendeuse", company: "X", bullets: ["Gestion de la caisse"] }],
  });
  const proposal = buildProposal(
    withNoise,
    { section: "experience", data: { id: "e777", bullets: [{ index: 0, after: "Gestion de la caisse de 777 clients" }], bullets_to_remove: [] } },
    () => `id${counter++}`,
  );
  assert.deepEqual(checkProposal(proposal, SCORING, withNoise, { mode: "demande" })[0].problems, [`${PROBLEM_NEW_NUMBER_PREFIX}777`]);
});

test("nombres : le téléphone ne justifie pas un chiffre dans une puce, mais peut être remis en forme", () => {
  const withPhone = CvDataSchema.parse({
    personal: { phone: "0612345678" },
    experiences: [{ id: "e1", position: "Vendeuse", company: "X", bullets: ["Gestion de la caisse"] }],
  });
  const make = (update) => buildProposal(withPhone, update, () => `id${counter++}`);
  const bullet = make({ section: "experience", data: { id: "e1", bullets: [{ index: 0, after: "Gestion de la caisse de 0612345678 clients" }], bullets_to_remove: [] } });
  assert.equal(checkProposal(bullet, SCORING, withPhone, { mode: "demande" }).length, 1);
  const phone = make({ section: "personal", data: { phone: "06 12 34 56 78" } });
  assert.deepEqual(checkProposal(phone, SCORING, withPhone, { mode: "demande" }), []);
  const other = make({ section: "personal", data: { phone: "06 99 99 99 99" } });
  assert.equal(checkProposal(other, SCORING, withPhone, { mode: "demande" }).length, 1);
  assert.deepEqual(checkProposal(other, SCORING, withPhone, { mode: "demande", candidateMessages: ["mon numéro est le 06 99 99 99 99"] }), []);
});

test("nombres : milliers groupés, décimales et traduction", () => {
  const allowed = numberSources(["Budget de 1 200 € et 2,5 jours, une quinzaine de clients, 30 % de hausse"]);
  assert.deepEqual(inventedNumbers("Budget of €1,200 over 2.5 days, about 15 clients, 30% increase", allowed), []);
  assert.deepEqual(inventedNumbers("Budget de 1200 €", allowed), []);
  assert.deepEqual(inventedNumbers("Budget de 12 000 €", allowed), ["12", "000"]);
  assert.deepEqual(inventedNumbers("Des dizaines de clients", allowed), ["dizaines"]);
});

test("déplacement et suppression : jamais vérifiés, dans les deux modes", () => {
  const moved = bullets({ index: 0, after: BULLETS[2] });
  assert.deepEqual(problemsOf(moved, "demande"), []);
  assert.deepEqual(problemsOf(moved, "parcours"), []);
  const removed = proposalFor({ section: "experience", data: { id: "e1", bullets: [], bullets_to_remove: [2] } });
  assert.deepEqual(problemsOf(removed, "demande"), []);
});

// --- Mode figé au premier essai (même vérification pour le nouvel essai) ---

test("le mode choisit la règle : la même proposition passe en « demande » et échoue en « parcours »", () => {
  const proposal = bullets({ index: 0, after: "Gestion de la caisse" });
  const firstMode = "parcours";
  // Second essai : le serveur vérifie avec le mode de la première réponse, quel que soit celui du second.
  assert.equal(checkProposal(proposal, SCORING, cv, { mode: firstMode }).length, 1);
  assert.equal(checkProposal(proposal, SCORING, cv, { mode: "demande" }).length, 0);
});

// --- Texte affiché ---

const outcome = {
  mode: "demande",
  section: "experience",
  applied: 0,
  stale: 0,
  invalid: false,
  firstInvalid: false,
  noChange: false,
  problems: [],
  firstProblems: [],
  message: "Combien de clients suivais-tu chez Boutique X ?",
  changeSummary: "",
  scoreBefore: 60,
  scoreAfter: null,
  corrections: [],
  offerKeywords: [],
};
const problem = (problems) => ({ changeId: "c1", text: "x", problems });

test("demande refusée : la cause exacte, sans demande de chiffre ni question de parcours", () => {
  const lost = coachReplyText({ ...outcome, problems: [problem([PROBLEM_LOST_FIGURE])] });
  assert.equal(
    lost,
    "Je n'ai pas pu faire cette modification : la nouvelle version perdait le chiffre de ta puce d'origine. Tu peux reformuler ta demande, ou modifier ce texte directement dans l'aperçu.",
  );
  const invented = coachReplyText({ ...outcome, problems: [problem([`${PROBLEM_NEW_NUMBER_PREFIX}150`])] });
  assert.ok(invented.includes("un nombre qui ne vient ni de ton CV ni de tes messages (150)"));
  for (const text of [lost, invented]) {
    assert.ok(!text.includes("ordre de grandeur"));
    assert.ok(!text.includes("Combien"));
  }
});

test("demande exécutée sous le seuil : annonce puis une question de parcours", () => {
  const text = coachReplyText({ ...outcome, applied: 1, changeSummary: "C'est fait : j'ai raccourci la puce.", scoreAfter: 62 });
  assert.equal(text, "C'est fait : j'ai raccourci la puce. Combien de clients suivais-tu chez Boutique X ?");
});

test("CV déjà clos : la proposition de continuer une demande est gardée, pas la question d'un parcours", () => {
  const closed = { ...outcome, applied: 1, changeSummary: "C'est fait.", scoreBefore: 84, scoreAfter: 84, message: "Je continue avec ton stage chez Y ?" };
  assert.equal(coachReplyText(closed), "C'est fait. Ton CV est à 84/100. Je continue avec ton stage chez Y ?");
  assert.equal(coachReplyText({ ...closed, mode: "parcours" }), "C'est fait. Ton CV est à 84/100.");
});

test("quota d'adaptations épuisé : le texte dit que c'est le quota qui bloque et ce qui reste à faire", () => {
  const request = quotaBlockedText({ mode: "demande", section: "summary", message: "Combien de clients ?" });
  assert.ok(request.includes("c'est ton quota d'adaptations du mois qui bloque"));
  assert.ok(request.includes("Reste à faire : la modification demandée sur ton accroche."));
  assert.ok(!request.includes("Combien"));
  const journey = quotaBlockedText({ mode: "parcours", section: "experience", message: "Combien de clients ?" });
  assert.ok(journey.includes("quota d'adaptations du mois qui bloque"));
  assert.ok(journey.endsWith("Reste à faire : la modification prévue sur une expérience. Combien de clients ?"));
});

test("CV clos à l'ouverture : texte fixe avec le score, sans question", () => {
  const text = closedOpening(86);
  assert.ok(text.includes("86/100"));
  assert.ok(!text.includes("?"));
});

// --- Raccourcir (lot « le coach écoute ») : au moins 20 % de mots en moins sur le texte visé ---

test("raccourcir : moins de 20 % de mots en moins est refusé, 20 % ou plus est accepté", async () => {
  const { PROBLEM_NOT_SHORTER } = await import("./coach-proposals.ts");
  const { coachReplyText } = await import("./coach-outcome.ts");
  // Accroche de 8 mots : 7 mots = -12 % (refusé) ; 5 mots = -37 % (accepté).
  const summary = (text) => proposalFor({ section: "summary", data: text });
  const check = (proposal, shorten) => checkProposal(proposal, SCORING, cv, { mode: "demande", shorten }).flatMap((p) => p.problems);
  assert.deepEqual(check(summary("Chargée de clientèle, 4 ans d'expérience en agence."), true), [PROBLEM_NOT_SHORTER]);
  assert.deepEqual(check(summary("Chargée de clientèle, 4 ans en agence."), true), []);
  // Sans demande de raccourcir : pas de règle de longueur.
  assert.deepEqual(check(summary("Chargée de clientèle, 4 ans d'expérience en agence."), false), []);
  // Supprimer une puce raccourcit : pas concerné.
  const removal = proposalFor({ section: "experience", data: { id: "e1", bullets: [], bullets_to_remove: [2] } });
  assert.deepEqual(check(removal, true), []);
  // Texte affiché : la raison honnête.
  const text = coachReplyText({
    mode: "demande",
    section: "summary",
    applied: 0,
    stale: 0,
    invalid: false,
    firstInvalid: false,
    noChange: false,
    problems: [{ changeId: "c", text: "x", problems: [PROBLEM_NOT_SHORTER] }],
    firstProblems: [],
    message: "",
    changeSummary: "",
    scoreBefore: 60,
    scoreAfter: null,
    corrections: [],
    offerKeywords: [],
  });
  assert.ok(text.startsWith("Je n'ai pas pu faire cette modification : je n'ai pas réussi à le raccourcir d'au moins 20 % sans retirer une information. Dis-moi ce que je peux enlever."), text);
});
