// Banc d'essai du coach (dernier lot, C6) : garde-fous mesurés par conversation, et faux positif
// connu du juge sur L16 (poste visé connu). Le banc n'est jamais lancé par les tests : mesures et
// rapport vérifiés sur des conversations fabriquées.
import assert from "node:assert/strict";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { lastLotOf } = await import("../../scripts/eval/metrics.ts");
const { judgeCorrections, lastLotTable } = await import("../../scripts/eval/report.ts");

const cv = (jobTitle, targetJob = "") => ({ personal: { jobTitle }, targetJob, experiences: [], analysis: null });
const t = (user, coachText, scoreAfter = 70, extra = {}) => ({ user, coachText, scoreAfter, firstProblems: [], problems: [], ...extra });
const record = (over) => ({ scenarioId: "L99-test", repeat: 0, offerId: null, opening: "Bonjour.", startCv: cv("Analyste"), turns: [], judge: null, ...over });

test("« prêt » sous 80 compté ; à 80 ou plus, rien", () => {
  const m = lastLotOf(record({ turns: [t("Merci", "Your CV is in good shape.", 77), t("Merci", "Ton CV est prêt.", 82)] }));
  assert.equal(m.readyClaimsUnder80, 1);
});

test("poste visé : mesuré seulement pour un CV libre sans cible", () => {
  assert.equal(lastLotOf(record({ startCv: cv("Étudiant"), opening: "Bonjour, quel poste vises-tu ?" })).targetAsked, true);
  assert.equal(lastLotOf(record({ startCv: cv("Étudiant"), opening: "Bonjour, combien de clients ?" })).targetAsked, false);
  assert.equal(lastLotOf(record({ startCv: cv("Senior Backend Engineer", "Senior Backend Engineer") })).targetAsked, null, "L16 : cible connue");
});

test("pivot : titre proposé et écart dit, mesurés après la déclaration ; null sans pivot", () => {
  const m = lastLotOf(record({ turns: [t("En fait je vise plutôt un poste de chef de projet événementiel.", "Veux-tu que je change ton titre ?"), t("Oui", "Pour un poste de « chef de projet événementiel », ton CV… J'ai fait le tour.")] }));
  assert.deepEqual(m.pivot, { titleProposed: true, gapSaid: true });
  assert.equal(lastLotOf(record({ turns: [t("Aide-moi", "Combien ?")] })).pivot, null);
});

test("chiffre redemandé compté ; autre chiffre (par mois) non", () => {
  const m = lastLotOf(record({ turns: [t("Je prépare 40 dossiers.", "Sur combien de dossiers réalises-tu l'analyse ? Combien de dossiers par mois ?")] }));
  assert.equal(m.givenFigureQuestions, 1);
});

test("rapport : tableau des garde-fous ; correction du juge sur L16 seulement si L16 est jugé", () => {
  const l16 = { record: record({ scenarioId: "L16-parcours-en", judge: { respect_demande: { note: 2, justification: "" } } }), metrics: { lastLot: lastLotOf(record({})) } };
  assert.match(lastLotTable([l16]), /\| L16-parcours-en \(0\) \| 0 \| — \| — \| 0 \| 0 \| 0 \|/);
  assert.match(judgeCorrections([l16]), /L16-parcours-en : le profil tech-confirme-en a un poste visé connu .* faux positif/);
  assert.equal(judgeCorrections([{ ...l16, record: { ...l16.record, judge: null } }]), null, "pas de juge (--dry)");
  assert.equal(judgeCorrections([{ ...l16, record: { ...l16.record, scenarioId: "L01-parcours-finance" } }]), null);
});
