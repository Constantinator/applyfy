// Texte affiché après une réponse du coach : cause d'échec et clôture. Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Imports relatifs sans extension (résolus par Next en temps normal).
registerHooks({
  resolve(specifier, context, next) {
    return next(/^\.\.?\/[^.]*$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
});
const { closureMessage, coachReplyText, MISSING_FIGURE_QUESTION } = await import("./coach-outcome.ts");
const { PROBLEM_BANNED_PREFIX, PROBLEM_NO_FIGURE, PROBLEM_NO_VERB } = await import("./coach-proposals.ts");
const { READY_SCORE } = await import("./cv-score.ts");

const base = {
  mode: "parcours",
  section: "experience",
  applied: 0,
  stale: 0,
  invalid: false,
  firstInvalid: false,
  noChange: false,
  problems: [],
  firstProblems: [],
  message: "",
  changeSummary: "",
  scoreBefore: 60,
  scoreAfter: null,
  corrections: [],
  offerKeywords: [],
};
const text = (patch) => coachReplyText({ ...base, ...patch });
const problem = (problems, extra = {}) => ({ changeId: "c1", text: "x", problems, ...extra });
const PREFIX = "Je n'ai pas pu modifier ton CV : ";

test("aucune modification voulue : le message du coach", () => {
  assert.equal(text({ section: null, message: "Quel est ton rôle ?" }), "Quel est ton rôle ?");
});

test("échec : format invalide", () => {
  assert.equal(text({ invalid: true }), `${PREFIX}la réponse que j'avais préparée avait un format invalide.`);
  // Second essai sans proposition, premier essai illisible.
  assert.equal(text({ firstInvalid: true }), `${PREFIX}la réponse que j'avais préparée avait un format invalide.`);
});

test("échec : pas de verbe d'action, sans question de chiffre", () => {
  const out = text({ problems: [problem([PROBLEM_NO_VERB])] });
  assert.equal(out, `${PREFIX}j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »).`);
  assert.ok(!out.includes("chiffre"));
});

test("échec : formule creuse", () => {
  const out = text({ problems: [problem([`${PROBLEM_BANNED_PREFIX}force de proposition »`])] });
  assert.equal(out, `${PREFIX}le texte proposé contenait « force de proposition », une formule trop vague pour un recruteur.`);
});

test("échec : limite de puces, puis autre limite", () => {
  const bullets = problem(["Le champ « Expérience : puces » contient trop d'éléments, maximum 12."], {
    limit: true,
    path: "experiences.0.bullets",
  });
  assert.equal(text({ problems: [bullets] }), `${PREFIX}la limite de 12 puces est atteinte pour cette expérience.`);
  const long = problem(["Le champ « Poste » est trop long, maximum 300 caractères."], { limit: true, path: "experiences.0.position" });
  assert.equal(text({ problems: [long] }), `${PREFIX}le champ « Poste » est trop long, maximum 300 caractères.`);
});

test("échec : passage modifié entre-temps", () => {
  assert.equal(text({ stale: 1 }), `${PREFIX}ce passage a changé entre-temps. Redemande-moi la modification.`);
});

test("échec : modification sans effet", () => {
  assert.equal(text({ noChange: true }), `${PREFIX}la modification proposée ne change rien à ton CV.`);
});

test("échec : chiffre manquant, seulement quand c'est la cause, avec la question de repli", () => {
  assert.equal(
    text({ problems: [problem([PROBLEM_NO_FIGURE])] }),
    `${PREFIX}il me manque un chiffre ou un ordre de grandeur pour écrire cette puce. ${MISSING_FIGURE_QUESTION}`,
  );
  // Le coach a déjà posé sa question : pas de question de repli.
  assert.equal(
    text({ problems: [problem([PROBLEM_NO_FIGURE])], message: "Combien de clients ?" }),
    `${PREFIX}il me manque un chiffre ou un ordre de grandeur pour écrire cette puce. Combien de clients ?`,
  );
});

test("échec : plusieurs causes, le chiffre en dernier", () => {
  const out = text({ problems: [problem([PROBLEM_NO_FIGURE, PROBLEM_NO_VERB])] });
  assert.equal(
    out,
    `${PREFIX}j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »). Il me manque un chiffre ou un ordre de grandeur pour écrire cette puce. ${MISSING_FIGURE_QUESTION}`,
  );
});

test("échec au second essai : causes du premier essai si le second ne propose plus rien", () => {
  assert.equal(
    text({ firstProblems: [problem([PROBLEM_NO_VERB])], message: "Peux-tu préciser ton rôle ?" }),
    `${PREFIX}j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »). Peux-tu préciser ton rôle ?`,
  );
});

test("échec hors expérience : motif, puis demande de reformuler", () => {
  const out = text({
    section: "summary",
    problems: [problem([`${PROBLEM_BANNED_PREFIX}dynamique »`])],
  });
  assert.equal(
    out,
    "Je n'ai pas pu appliquer cette modification à ton CV. Le texte proposé contenait « dynamique », une formule trop vague pour un recruteur. Peux-tu reformuler ta demande ?",
  );
  assert.equal(
    text({ section: "skills", stale: 1 }),
    "Je n'ai pas pu appliquer cette modification à ton CV. Ce passage a changé entre-temps. Redemande-moi la modification. Peux-tu reformuler ta demande ?",
  );
});

test("modification partielle : jamais le résumé du modèle, la cause des puces refusées", () => {
  assert.equal(
    text({ applied: 1, scoreBefore: 50, scoreAfter: 55, changeSummary: "C'est fait : j'ai mis à jour ton stage.", problems: [problem([PROBLEM_NO_VERB])] }),
    "C'est fait : j'ai mis à jour ton CV. Certaines puces n'ont pas été ajoutées : j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »).",
  );
  assert.equal(
    text({ applied: 1, scoreBefore: 50, scoreAfter: 55, changeSummary: "C'est fait.", problems: [problem([PROBLEM_NO_FIGURE])] }),
    `C'est fait : j'ai mis à jour ton CV. Certaines puces n'ont pas été ajoutées : il me manque un chiffre ou un ordre de grandeur pour écrire cette puce. ${MISSING_FIGURE_QUESTION}`,
  );
});

test("annonce fidèle : emplacements réellement modifiés, et chaque texte refusé avec son emplacement", () => {
  const out = text({
    applied: 1,
    scoreBefore: 50,
    scoreAfter: 55,
    changeSummary: "C'est fait : j'ai ajouté tes 12 patients à ta puce de soins et tes 3 étudiants à ta puce d'encadrement.",
    appliedLabels: ["Infirmière chez CH Fictif — puce 2"],
    refusedLabels: { c1: "Infirmière chez CH Fictif — puce 1", c2: "Infirmière chez CH Fictif — puce 2" },
    problems: [problem([PROBLEM_NO_VERB])],
  });
  assert.equal(out, `C'est fait, j'ai modifié : Infirmière chez CH Fictif (puce 2). Pas modifié — Infirmière chez CH Fictif (puce 1) : j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »).`);
  assert.ok(!out.includes("12 patients"), "le résumé du modèle n'est pas repris");
});

test("annonce fidèle : résumé du modèle gardé si tout est appliqué, écarté s'il cite une puce inchangée", () => {
  const ok = { applied: 1, scoreBefore: 50, scoreAfter: 55, changeSummary: "C'est fait : j'ai chiffré ta puce.", appliedLabels: ["Stage chez X — puce 1"] };
  assert.equal(text(ok), "C'est fait : j'ai chiffré ta puce.");
  assert.equal(text({ ...ok, summaryFaithful: false }), "C'est fait, j'ai modifié : Stage chez X (puce 1).");
});

test("sous le seuil : comportement inchangé, la question du coach est gardée", () => {
  assert.equal(
    text({ applied: 1, scoreBefore: 70, scoreAfter: READY_SCORE - 1, changeSummary: "C'est fait : j'ai ajouté tes résultats.", message: "Et pour ton stage chez X ?" }),
    "C'est fait : j'ai ajouté tes résultats. Et pour ton stage chez X ?",
  );
  assert.equal(
    text({ applied: 1, scoreBefore: 70, scoreAfter: 75, message: "Question suivante ?" }),
    "C'est fait : j'ai mis à jour ton CV. Question suivante ?",
  );
});

test("clôture : passage de 79 à 80, texte complet sans la question du coach", () => {
  const out = text({
    applied: 1,
    scoreBefore: 79,
    scoreAfter: 80,
    changeSummary: "C'est fait : j'ai ajouté tes résultats.",
    message: "Et pour ton stage chez X ?",
  });
  assert.equal(
    out,
    "C'est fait : j'ai ajouté tes résultats. Ton CV est prêt : il atteint 80/100 (seuil de 80). Tu peux encore le modifier en cliquant sur n'importe quel texte dans l'aperçu, ou me demander une modification précise. Bonne chance pour tes candidatures.",
  );
  assert.ok(!out.includes("?"));
});

test("clôture : pistes facultatives (3 corrections et 3 mots-clés de l'offre au plus)", () => {
  const out = text({
    applied: 1,
    scoreBefore: 78,
    scoreAfter: 81,
    corrections: ["1 puce sans chiffre — A", "Dates sans mois — B", "2 puces de plus de 30 mots — C", "quatrième"],
    offerKeywords: ["SQL", "Power BI", "dbt", "Airflow"],
  });
  assert.ok(
    out.endsWith(
      "Pistes facultatives, sans urgence : 1 puce sans chiffre — A ; Dates sans mois — B ; 2 puces de plus de 30 mots — C ; mots-clés de l'offre à envisager : SQL, Power BI, dbt.",
    ),
  );
  assert.ok(!out.includes("quatrième") && !out.includes("Airflow"));
  assert.equal(closureMessage(80, [], []).includes("Pistes"), false);
});

test("déjà prêt avant (80 → 83) : une ligne courte, sans nouvelle clôture", () => {
  const out = text({ applied: 1, scoreBefore: 80, scoreAfter: 83, changeSummary: "C'est fait : j'ai raccourci ta puce.", message: "Autre question ?" });
  assert.equal(out, "C'est fait : j'ai raccourci ta puce. Ton CV est à 83/100.");
});

test("déjà prêt avant et après (85 → 85) : une ligne courte", () => {
  const out = text({ applied: 1, scoreBefore: 85, scoreAfter: 85, message: "Autre question ?" });
  assert.equal(out, "C'est fait : j'ai mis à jour ton CV. Ton CV est à 85/100.");
  assert.ok(!out.includes("prêt"));
});

test("aucun changement appliqué : jamais de clôture, même à 80 ou plus", () => {
  const out = text({ scoreBefore: 85, scoreAfter: null, problems: [problem([PROBLEM_NO_VERB])] });
  assert.equal(out, `${PREFIX}j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »).`);
  assert.ok(!out.includes("prêt") && !out.includes("/100"));
});

test("clôture avec une partie refusée : la cause est dite avant la clôture", () => {
  const out = text({ applied: 1, scoreBefore: 79, scoreAfter: 80, problems: [problem([PROBLEM_NO_VERB])] });
  assert.ok(out.includes("Certaines puces n'ont pas été ajoutées : j'ai besoin que la puce commence par ce que tu as fait concrètement (par exemple « Suivi de… », « Organisation de… »). Ton CV est prêt"));
});

test("limite de puces : chemin réel produit par checkProposal", async () => {
  const { CvDataSchema } = await import("./cv-builder-types.ts");
  const { buildProposal, checkProposal } = await import("./coach-proposals.ts");
  const bullets = Array.from({ length: 12 }, (_, i) => `Pilotage de ${i + 2} projets`);
  const cv = CvDataSchema.parse({ experiences: [{ id: "e1", position: "Analyste", company: "X", bullets }] });
  let n = 0;
  const proposal = buildProposal(
    cv,
    { section: "experience", data: { id: "e1", bullets: [{ index: -1, after: "Réduction des coûts de 12 %" }], bullets_to_remove: [] } },
    () => `id${n++}`,
  );
  const problems = checkProposal(proposal, { actionVerbs: [], avoid: [] }, cv);
  assert.equal(problems[0].path, "experiences.0.bullets");
  assert.equal(text({ problems }), `${PREFIX}la limite de 12 puces est atteinte pour cette expérience.`);
});
