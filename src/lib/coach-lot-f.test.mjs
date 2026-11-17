// Lot F du coach : plusieurs mises à jour par réponse (L14 : titre et puce demandés en un message,
// seul le titre était fait). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { test } from "node:test";

import { contextFor, fakeClient, flat, profile, quiet, turn } from "./coach-test-fixtures.mjs";

const { isBareYes } = await import("./coach-intent.ts");
const { coachBuilderCv } = await import("./coach-llm.ts");
const { buildProposal, buildProposals, updateTarget } = await import("./coach-proposals.ts");
const { capUpdates, runCoachTurn, updatesCap } = await import("./coach-turn.ts");

const cv = profile("finance-junior-fr");
const title = (jobTitle) => ({ section: "personal", data: JSON.stringify({ jobTitle }) });
const bullet = (index, after, id = "fj-e1") => ({ section: "experience", data: JSON.stringify({ id, bullets: [{ index, after }] }) });
const skills = (names) => ({ section: "skills", data: JSON.stringify(names.map((name) => ({ name, level: "" }))) });
const summary = (text) => ({ section: "summary", data: text });
const demande = (updates, patch = {}) => flat({ mode: "demande", change_summary: "C'est fait.", message: "On continue avec ton stage ?", updates, ...patch });
const play = (request, reply, history = [{ role: "assistant", content: "Combien de dossiers traitais-tu par mois ?" }]) =>
  turn(cv, contextFor(cv, null, { history, request }), history, request, reply);

/** L14 : titre et reformulation d'une puce dans le même message. */
const L14_REQUEST = "Mets « Analyste crédit » en titre et reformule ma 2e puce chez Banque Fictive : je préparais 6 comités de crédit par mois.";

// --- 2. Plusieurs mises à jour : construction, plafond, second essai ---

test("buildProposals : une seule mise à jour, exactement buildProposal ; plusieurs, changements concaténés avec leur cible", () => {
  let seed = 0;
  const ids = () => () => `id${seed++}`;
  const update = { section: "experience", data: { id: "fj-e1", bullets: [{ index: 0, after: "Analyse de 40 dossiers de crédit PME par mois" }], bullets_to_remove: [] } };
  seed = 0;
  const single = buildProposal(cv, update, ids());
  seed = 0;
  assert.deepEqual(buildProposals(cv, [update], ids()).proposal, single);
  const { proposal, targets } = buildProposals(cv, [{ section: "personal", data: { jobTitle: "Analyste crédit" } }, update]);
  assert.equal(proposal.changes.length, 2);
  assert.deepEqual(Object.values(targets), ["personal", "experience:fj-e1"]);
  assert.equal(updateTarget("projects", { id: "p1" }), "projects:p1");
  assert.equal(updateTarget("experience", "{illisible"), "experience:");
});

test("plafond : 3 en mode demande, 1 en parcours, 1 pour un « oui » ou un « ok » seul", () => {
  assert.equal(updatesCap("demande", L14_REQUEST), 3);
  assert.equal(updatesCap("parcours", "Je préparais 6 comités par mois."), 1);
  for (const yes of ["oui", "Oui !", "ok", "Ok vas-y", "d'accord, continue", "Ah oui, continue stp", "yes please"]) {
    assert.equal(isBareYes(yes), true, yes);
    assert.equal(updatesCap("demande", yes), 1, yes);
  }
  for (const more of ["oui, et ajoute SQL à mes compétences", "ok, raccourcis aussi l'accroche", "Oui, environ 20.", "non", "Mets oui en titre"]) {
    assert.equal(isBareYes(more), false, more);
  }
  const reply = { updates: [1, 2, 3, 4].map((n) => ({ section: n === 4 ? "interests" : "summary", data: "x" })), raw: [], invalid: false };
  reply.raw = reply.updates.map((u) => ({ section: u.section, data: "x" }));
  const capped = capUpdates(reply, 3);
  assert.equal(capped.reply.updates.length, 3);
  assert.deepEqual(capped.dropped, ["interests"]);
  // Contenu invalide compté à sa place : la limite suit l'ordre écrit par le modèle.
  const mixed = { updates: [{ section: "summary", data: "a" }, { section: "interests", data: "b" }], invalid: true, raw: [{ section: "skills", data: "{", invalid: true }, { section: "summary", data: "a" }, { section: "interests", data: "b" }] };
  const one = capUpdates(mixed, 1);
  assert.deepEqual(one.reply.updates, []);
  assert.equal(one.reply.invalid, true);
  assert.deepEqual(one.dropped, ["summary", "interests"]);
});

test("L14 : titre et puce demandés en un message, les deux appliqués", async () => {
  const result = await play(L14_REQUEST, demande([title("Analyste crédit"), bullet(1, "Préparation de 6 comités de crédit par mois")]));
  assert.equal(result.applied, 2);
  assert.equal(result.updated.personal.jobTitle, "Analyste crédit");
  assert.equal(result.updated.experiences[0].bullets[1], "Préparation de 6 comités de crédit par mois");
  assert.deepEqual(result.sections, ["personal", "experience"]);
  assert.deepEqual(result.droppedSections, []);
});

test("plafond : 4 mises à jour demandées, 3 appliquées ; « oui » à « je continue » et parcours : une seule", async () => {
  const four = demande([title("Analyste crédit"), summary("Analyste crédit junior, banque et audit."), skills(["Excel", "SQL"]), { section: "interests", data: "Course à pied" }]);
  const many = await play("Mets Analyste crédit en titre, raccourcis l'accroche, ajoute SQL et mets la course à pied dans mes centres d'intérêt.", four);
  assert.equal(many.applied, 3);
  assert.deepEqual(many.droppedSections, ["interests"]);
  assert.equal(many.updated.interests, cv.interests);

  const history = [{ role: "assistant", content: "C'est fait pour ton titre. Je continue avec ton accroche et tes compétences ?" }];
  const yes = await play("oui", demande([summary("Analyste crédit junior, banque et audit."), skills(["Excel", "SQL"])]), history);
  assert.equal(yes.applied, 1);
  assert.deepEqual(yes.sections, ["summary"]);
  assert.deepEqual(yes.droppedSections, ["skills"]);

  const path = await play("Je préparais 6 comités de crédit par mois.", flat({ updates: [bullet(1, "Préparation de 6 comités de crédit par mois"), title("Analyste crédit")] }));
  assert.equal(path.applied, 1);
  assert.equal(path.updated.personal.jobTitle, cv.personal.jobTitle);
});

test("contrôles par mise à jour : suppression non demandée refusée seule, contenu invalide écarté seul", async () => {
  const removal = { section: "experience", data: JSON.stringify({ id: "fj-e2", bullets: [], bullets_to_remove: [0] }) };
  const result = await play(L14_REQUEST, demande([title("Analyste crédit"), removal]));
  assert.equal(result.applied, 1);
  assert.equal(result.updated.personal.jobTitle, "Analyste crédit");
  assert.equal(result.updated.experiences[1].bullets.length, cv.experiences[1].bullets.length);
  assert.ok(result.problems.length >= 1);

  const invalid = await play(L14_REQUEST, demande([title("Analyste crédit"), { section: "experience", data: "{pas du json" }]));
  assert.equal(invalid.applied, 1);
  assert.equal(invalid.updated.personal.jobTitle, "Analyste crédit");
});

test("second essai : changements valides du premier essai gardés, seule la cible refusée reprise", async () => {
  const history = [{ role: "assistant", content: "Combien de dossiers traitais-tu par mois ?" }];
  const context = contextFor(cv, null, { history, request: L14_REQUEST });
  // Premier essai : titre valide, puce avec un nombre inventé (8).
  const first = await coachBuilderCv(fakeClient(demande([title("Analyste crédit"), bullet(1, "Préparation de 8 comités de crédit par mois")])), context, history, L14_REQUEST);
  // Second essai : la puce corrigée, et un autre titre, ignoré (cible acceptée au premier essai).
  const second = await coachBuilderCv(fakeClient(demande([title("Chargée de crédit"), bullet(1, "Préparation de 6 comités de crédit par mois")])), context, history, L14_REQUEST);
  const retries = [];
  const result = await quiet(() =>
    runCoachTurn({ current: cv, context, turns: history, request: L14_REQUEST, reply: first, limitReached: false, retry: async (r) => (retries.push(r), second) }),
  );
  assert.equal(retries.length, 1);
  assert.deepEqual(retries[0].previous.map((p) => p.section), ["personal", "experience"]);
  assert.equal(result.updated.personal.jobTitle, "Analyste crédit");
  assert.equal(result.updated.experiences[0].bullets[1], "Préparation de 6 comités de crédit par mois");
  assert.equal(result.applied, 2);
  assert.deepEqual(result.problems, []);
});

// --- 3. Annonce combinée et dépassement du plafond ---

test("L14 : titre et puce annoncés tous les deux, dans la langue du candidat", async () => {
  const result = await play(L14_REQUEST, demande([title("Analyste crédit"), bullet(1, "Préparation de 6 comités de crédit par mois")]));
  assert.match(result.text, /^C'est fait : « Préparation de 6 comités de crédit par mois » — Analyste crédit junior chez Banque Fictive \(puce 2\)\. J'ai aussi modifié : Titre du CV\./);
  assert.ok(result.text.endsWith("On continue avec ton stage ?"), result.text);

  const en = "Set “Credit analyst” as my title and rephrase my 2nd bullet at Banque Fictive: I prepared 6 credit committees a month.";
  const english = await play(en, demande([title("Analyste crédit"), bullet(1, "Préparation de 6 comités de crédit par mois")], { message: "Shall we move on to your internship?" }));
  assert.ok(english.text.includes("I also updated: CV title."), english.text);
});

test("annonce combinée : accroche et compétences ; une seule section, annonce inchangée", async () => {
  const both = await play("Remplace mon accroche par « Analyste crédit junior, banque et audit » et ajoute SQL à mes compétences.", demande([summary("Analyste crédit junior, banque et audit."), skills(["Excel", "Analyse financière", "Travail en équipe", "SQL"])]));
  assert.equal(both.applied, 2, both.text);
  assert.match(both.text, /^C'est fait : ton accroche est maintenant « Analyste crédit junior, banque et audit »\. J'ai aussi modifié : Compétences\./);
  const one = await play("Reformule ma 2e puce chez Banque Fictive : je préparais 6 comités de crédit par mois.", demande([bullet(1, "Préparation de 6 comités de crédit par mois")]));
  assert.ok(!one.text.includes("aussi modifié"), one.text);
});

test("plafond dépassé : « Je n'ai fait que les 3 premières ; je continue avec … ? » à la place de la question", async () => {
  const four = demande([title("Analyste crédit"), summary("Analyste crédit junior, banque et audit."), skills(["Excel", "SQL"]), { section: "interests", data: "Course à pied" }]);
  const many = await play("Mets Analyste crédit en titre, raccourcis l'accroche, ajoute SQL et mets la course à pied dans mes centres d'intérêt.", four);
  assert.ok(many.text.endsWith("Je n'ai fait que les 3 premières ; je continue avec tes centres d'intérêt ?"), many.text);
  assert.ok(!many.text.includes("On continue avec ton stage ?"), many.text);

  const history = [{ role: "assistant", content: "C'est fait pour ton titre. Je continue avec ton accroche et tes compétences ?" }];
  const yes = await play("oui", demande([summary("Analyste crédit junior, banque et audit."), skills(["Excel", "SQL"])]), history);
  assert.ok(yes.text.endsWith("Je n'ai fait que la première ; je continue avec tes compétences ?"), yes.text);

  // Parcours : la mise à jour en trop est retirée sans phrase.
  const path = await play("Je préparais 6 comités de crédit par mois.", flat({ message: "Et pour ton stage ?", updates: [bullet(1, "Préparation de 6 comités de crédit par mois"), title("Analyste crédit")] }));
  assert.ok(!path.text.includes("Je n'ai fait que"), path.text);
});

// --- 4. Raccourcissement limité : plusieurs sections, la liste n'est pas vérifiée ---

test("raccourcis l'accroche et ajoute SQL : les deux appliqués, décompte des mots sur l'accroche seule", async () => {
  const result = await play(
    "Raccourcis mon accroche et ajoute SQL à mes compétences.",
    demande([summary("Analyste crédit junior, banque et audit."), skills(["Excel", "Analyse financière", "Travail en équipe", "SQL"])]),
  );
  assert.equal(result.applied, 2, result.text);
  assert.deepEqual(result.problems, []);
  assert.ok(result.updated.skills.some((s) => s.name === "SQL"));
  assert.ok(result.text.includes("Le texte passe de 15 à 6 mots."), result.text);
  assert.match(result.text, /^C'est fait, j'ai modifié : Accroche ; Compétences. Le texte passe de 15 à 6 mots./);
});

test("raccourcissement : une liste seule reste vérifiée, l'accroche aussi quand plusieurs sections", async () => {
  const { checkProposal, buildProposals, PROBLEM_NOT_SHORTER } = await import("./coach-proposals.ts");
  const longer = [...cv.skills.map((s) => s.name), "SQL", "Python"].map((name) => ({ name, level: "" }));
  const list = buildProposals(cv, [{ section: "skills", data: longer }]).proposal;
  const ctx = { actionVerbs: [], avoid: [] };
  assert.deepEqual(checkProposal(list, ctx, cv, { mode: "demande", shorten: true }).flatMap((p) => p.problems), [PROBLEM_NOT_SHORTER]);
  const both = buildProposals(cv, [{ section: "summary", data: `${cv.summary} Encore plus.` }, { section: "skills", data: longer }]).proposal;
  const problems = checkProposal(both, ctx, cv, { mode: "demande", shorten: true });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].text, `${cv.summary} Encore plus.`);
});

// --- 6. Banc d'essai : réponses sur plusieurs sections, mises à jour au-delà du plafond ---

const evalMetrics = await import("../../scripts/eval/metrics.ts");
const { changedSections } = await import("../../scripts/eval/conversation.ts");

const turnRecord = (patch) => ({
  user: "…", coachText: "…", error: null, mode: "demande", scoreBefore: 60, scoreAfter: 60, applied: 1, retried: false,
  problems: [], firstProblems: [], claim: null, unchangedQuoted: [], skipped: [], section: null, offerGap: "", ...patch,
});
const evalRecord = (turns) => ({
  scenarioId: "X", set: "dev", case: "libre", type: "demande", repeat: 0, language: "fr", sectorStart: "finance",
  startScore: 60, endScore: 60, startCv: cv, endCv: cv, opening: "Bonjour", offer: null, judge: null, endReason: "fin", turns,
});

test("banc d'essai : sections réellement modifiées, échanges sur plusieurs sections et mises à jour au-delà du plafond", async () => {
  const result = await play(L14_REQUEST, demande([title("Analyste crédit"), bullet(1, "Préparation de 6 comités de crédit par mois")]));
  assert.deepEqual(changedSections(cv, result.updated), ["personal", "experience"]);
  assert.deepEqual(changedSections(cv, cv), []);
  const m = evalMetrics.computeMetrics(
    evalRecord([
      turnRecord({ appliedSections: ["personal", "experience"], sections: ["personal", "experience"] }),
      turnRecord({ appliedSections: ["summary"], sections: ["summary"], droppedSections: ["skills"] }),
      turnRecord({ section: "summary" }), // run d'avant le lot F : champs absents
    ]),
    { id: "X", case: "libre", expectedSector: "finance" },
  );
  assert.equal(m.multiSectionTurns, 1);
  assert.equal(m.droppedUpdates, 1);
});
