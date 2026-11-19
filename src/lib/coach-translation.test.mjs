// Coach et traduction (lot traduction, C5) : « traduis tout mon CV » reçoit un texte fixe du
// serveur (sans modèle ni décompte), le diplôme n'est jamais traduit, les libellés des champs sont
// cohérents dans l'annonce, et la phrase O10 renvoie au bouton. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { isTranslationRequest, isWholeCvTranslationRequest } = await import("./coach-intent.ts");
const { bulletAnnouncement, wholeCvTranslationReply } = await import("./coach-outcome.ts");
const { buildProposal, checkProposal, PROBLEM_DEGREE_TRANSLATED } = await import("./coach-proposals.ts");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { COMMON_ACTION_VERBS } = await import("./cv-sector-context.ts");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const fixture = (path) => JSON.parse(readFileSync(new URL(`../../scripts/eval/fixtures/${path}`, import.meta.url), "utf8"));

test("« tout le CV » : déclenché par une demande de traduction de tout le CV (français, anglais)", () => {
  for (const message of [
    "Peux-tu traduire tout mon CV en anglais ? Je postule à Londres.",
    "traduis mon cv en anglais stp",
    "Tu peux traduire le CV en entier ?",
    "Traduis tout en anglais",
    "Can you translate my whole CV into French?",
    "please translate my resume",
    "translate everything into French",
    "Traduction de tout mon CV en anglais, merci",
  ]) {
    assert.equal(isWholeCvTranslationRequest(message), true, message);
  }
});

test("« tout le CV » : pas déclenché par une partie précise, un fait passé, un métier ou une compétence", () => {
  for (const message of [
    "Traduis mon accroche en anglais",
    "Traduis ma 2e puce chez Banque Fictive",
    "Peux-tu traduire mon résumé ?",
    "Can you translate my summary?",
    "Translate the bullets of my last experience",
    "J'ai traduit 40 contrats par mois",
    "I translated 12 technical manuals",
    "Je suis traductrice chez Agence Exemple",
    "Ajoute la traduction technique à mes compétences",
    "Raccourcis tout mon CV",
    "oui",
  ]) {
    assert.equal(isWholeCvTranslationRequest(message), false, message);
  }
  assert.equal(isTranslationRequest("J'ai traduit des contrats"), false);
  assert.equal(isTranslationRequest("Traduis mon accroche"), true);
});

test("réponse fixe : renvoie au bouton de l'onglet Style, dans la langue du candidat, sans promesse de traduire ici tout le CV", () => {
  assert.match(wholeCvTranslationReply("fr"), /« Traduire en anglais » ou « Traduire en français » de l'onglet Style/);
  assert.match(wholeCvTranslationReply("fr"), /remplace le contenu de ton CV par sa traduction/);
  assert.doesNotMatch(wholeCvTranslationReply("fr") + wholeCvTranslationReply("en"), /copie|copy/i);
  assert.match(wholeCvTranslationReply("en"), /Style tab/);
  assert.doesNotMatch(wholeCvTranslationReply("fr") + wholeCvTranslationReply("en"), /\?/);
});

test("action du coach : « tout le CV » répond avant le contrôle du quota, sans appel au modèle ni décompte", () => {
  const source = read("app/actions/cv-builder.ts");
  const body = source.slice(source.indexOf("export async function refineBuilderCvAction"));
  const branchStart = body.indexOf("if (isWholeCvTranslationRequest(request))");
  assert.ok(branchStart > 0);
  const branch = body.slice(branchStart, body.indexOf("\n  }\n", branchStart));
  assert.ok(branchStart < body.indexOf("const gate = await coachGate()"));
  assert.ok(branchStart < body.indexOf("coachBuilderCv(context"));
  assert.doesNotMatch(branch, /recordAiUsage|coachBuilderCv|coachGate|checkAiAccess/);
  assert.match(branch, /wholeCvTranslationReply\(candidateLanguage\(/);
});

const tech = CvDataSchema.parse(fixture("profiles/dev/tech-confirme-en.json").cv);
const context = { actionVerbs: COMMON_ACTION_VERBS, avoid: [] };
const degreeChange = () => {
  let n = 0;
  return buildProposal(tech, { section: "education", data: { id: "te-d1", degree: "Master en informatique", honors: "Mention bien" } }, () => `c${n++}`);
};

test("traduction demandée : l'intitulé d'un diplôme n'est jamais traduit (les autres champs le sont)", () => {
  const proposal = degreeChange();
  const problems = checkProposal(proposal, context, tech, { mode: "demande", candidateMessages: ["Traduis ma formation en français"], translation: true });
  const degree = proposal.changes.find((c) => c.field === "degree");
  const honors = proposal.changes.find((c) => c.field === "honors");
  assert.deepEqual(problems.find((p) => p.changeId === degree.id)?.problems, [PROBLEM_DEGREE_TRANSLATED]);
  assert.equal(problems.find((p) => p.changeId === honors.id), undefined);
});

test("sans traduction demandée, un diplôme corrigé par le candidat n'est pas refusé", () => {
  const problems = checkProposal(degreeChange(), context, tech, { mode: "demande", candidateMessages: ["Corrige l'intitulé de mon diplôme : Master en informatique"] });
  assert.ok(!problems.some((p) => p.problems.includes(PROBLEM_DEGREE_TRANSLATED)));
});

test("coach-turn : l'option de traduction suit le dernier message du candidat", () => {
  assert.match(read("lib/coach-turn.ts"), /\.\.\.\(isTranslationRequest\(request\) \? \{ translation: true \} : \{\}\)/);
});

test("annonce : libellé du diplôme cohérent (« Intitulé du diplôme », « degree title »), champs traduits en anglais", () => {
  const label = degreeChange().changes.find((c) => c.field === "degree").label;
  assert.equal(label, "MSc Computer Science — Intitulé du diplôme");
  const change = (l) => [{ kind: "written", text: "Master en informatique", label: l }];
  assert.match(bulletAnnouncement(change(label), "fr"), /MSc Computer Science \(Intitulé du diplôme\)/);
  assert.match(bulletAnnouncement(change(label), "en"), /MSc Computer Science \(degree title\)/);
  assert.doesNotMatch(bulletAnnouncement(change(label), "en"), /Diplôme|Intitulé/);
  assert.match(bulletAnnouncement(change("Backend Engineer chez Example Tech SAS — Poste"), "en"), /Backend Engineer at Example Tech SAS \(job title\)/);
  assert.match(bulletAnnouncement(change("Stage chez X — Lieu"), "en"), /\(location\)/);
});
