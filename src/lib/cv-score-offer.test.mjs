// Lot score (S1) : pour un CV lié, les 20 points « Mots-clés » viennent des mots-clés de l'offre
// (cv_suggestions), à la place de ceux du secteur ; repli sur le secteur sans mot-clé compté ; CV
// libre inchangé. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { scoreCv, offerKeywordScore, offerKeywordsLine, OFFER_KEYWORDS_RATIO } = await import("./cv-score.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { scoringOfferFor } = await import("./cv-sector-context.ts");
const { isBehaviouralKeyword, offerScoreKeywords } = await import("./cv-keyword-match.ts");

const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);
const profiles = ["dev", "holdout"].flatMap((set) =>
  readdirSync(new URL(`profiles/${set}/`, FIXTURES))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(`profiles/${set}/${f}`, FIXTURES), "utf8"))),
);
const profile = (id) => CvDataSchema.parse(profiles.find((p) => p.id === id).cv);

/** Candidature liée, au format lu en base, avec ses mots-clés (groupe « technique » par défaut). */
function detail(keywords, extra = {}) {
  return {
    application: {
      id: "app-1",
      position: "Développeur backend",
      company: "Éditeur Fictif",
      sector: "tech",
      offer_description: "API",
      cv_suggestions: {
        keywords: keywords.map((k, i) => (typeof k === "string" ? { keyword: k, group: "technique", variants: [], weight: 10 - i } : k)),
        ignored: [],
        conseils: [],
        titre_cv: "",
        cvText: null,
        ...extra,
      },
    },
  };
}
const linked = (cv, d) => scoringContextFrom(cv, scoringOfferFor("app-1", d), []);
const keywordsCategory = (score) => score.categories.find((c) => c.id === "keywords").score;
const withSkills = (cv, names) => ({ ...cv, skills: names.map((name, i) => ({ id: `s${i}`, name, level: "" })) });

test("CV libre : aucun mot-clé de l'offre dans le contexte, calcul du secteur", () => {
  for (const p of profiles) {
    const cv = CvDataSchema.parse(p.cv);
    const scoring = scoringContextFrom(cv, null, ["reporting"]);
    assert.equal("offerKeywords" in scoring, false, p.id);
    assert.equal(offerKeywordScore(cv, scoring), null, p.id);
  }
});

test("CV lié : les mots-clés de l'offre remplacent ceux du secteur", () => {
  const cv = withSkills(profile("tech-stage-fr"), ["JavaScript", "React"]);
  const scoring = linked(cv, detail(["Kafka", "Kubernetes", "Spring Boot", "Java", "microservices"]));
  assert.equal(scoring.offerKeywords.length, 5);
  const score = scoreCv(cv, scoring);
  // JavaScript et React sont des mots-clés du secteur tech, pas de l'offre : aucun point.
  assert.equal(keywordsCategory(score), 0);
  const correction = score.corrections.find((c) => c.category === "keywords");
  assert.equal(correction.message, "Mots-clés de l'offre : 0 sur 3 visés");
  assert.match(correction.request, /^Ajoute à mon CV les mots-clés de l'offre que j'ai vraiment pratiqués \(seulement ceux-là\), par exemple : Kafka, Kubernetes/);
});

test("repli sur le secteur : ancienne analyse, offre sans mot-clé, seulement des comportementaux", () => {
  const cv = profile("tech-stage-fr");
  const free = scoreCv(cv, scoringContextFrom(cv, null, []));
  const legacy = { application: { ...detail([]).application, cv_suggestions: { ce_qui_matche: [], ce_qui_manque: ["Docker"] } } };
  for (const d of [legacy, detail([]), detail(["Autonomie", { keyword: "Curiosité technique", group: "comportementale", variants: [], weight: 1 }])]) {
    const scoring = linked(cv, d);
    assert.equal("offerKeywords" in scoring, false);
    assert.equal(keywordsCategory(scoreCv(cv, scoring)), keywordsCategory(free));
  }
});

test("chaque mot-clé compte une fois : répétitions, variantes et équivalents français/anglais", () => {
  const cv = withSkills(profile("tech-stage-fr"), ["Docker", "Docker Compose", "Docker", "PostgreSQL"]);
  const d = detail([
    { keyword: "Docker", group: "technique", variants: ["conteneurs Docker"], weight: 3 },
    { keyword: "conteneurs Docker", group: "technique", variants: [], weight: 2 },
    "PostgreSQL",
    "Kafka",
  ]);
  const s = offerKeywordScore(cv, linked(cv, d));
  assert.deepEqual(s.found, ["Docker", "PostgreSQL"]);
  assert.equal(s.counted, 3, "« Docker » et sa variante écrite comme un autre mot-clé : un seul");
  // Équivalent français/anglais (cv-keyword-aliases) : un CV anglais trouve le mot-clé français.
  const finance = { ...withSkills(profile("finance-junior-fr"), ["Financial modelling"]) };
  const f = { application: { ...detail(["modélisation financière", "financial modelling", "Kafka"]).application, sector: "finance" } };
  const fs = offerKeywordScore(finance, linked(finance, f));
  assert.equal(fs.counted, 2);
  assert.deepEqual(fs.found, ["modélisation financière"]);
});

test("seuil : min(10, ⌈0,6 × n⌉) mots-clés trouvés pour 20 points", () => {
  assert.equal(OFFER_KEYWORDS_RATIO, 0.6);
  const cv = withSkills(profile("tech-stage-fr"), ["K1", "K2", "K3", "K4", "K5"]);
  const names = (n) => Array.from({ length: n }, (_, i) => `K${i + 1}`);
  for (const [n, target] of [[1, 1], [5, 3], [8, 5], [16, 10], [25, 10]]) {
    assert.equal(offerKeywordScore(cv, linked(cv, detail(names(n)))).target, target, `n = ${n}`);
  }
  // 5 trouvés sur 8 : 5 visés, note maximale ; 2 trouvés sur 8 : 2/5 de 20 = 8.
  assert.equal(offerKeywordScore(cv, linked(cv, detail(names(8)))).points, 20);
  const two = withSkills(profile("tech-stage-fr"), ["K1", "K2"]);
  assert.equal(offerKeywordScore(two, linked(two, detail(names(8)))).points, 8);
  assert.equal(offerKeywordsLine({ found: ["a", "b", "c", "d", "e", "f"], target: 5 }), "Mots-clés de l'offre : 5 sur 5 visés");
});

test("compétences comportementales : exclues du score et du seuil (catégorie de l'analyse ou liste fixe)", () => {
  assert.ok(isBehaviouralKeyword({ keyword: "Esprit d'équipe", group: "technique" }), "ancienne analyse : liste fixe");
  assert.ok(isBehaviouralKeyword({ keyword: "Sens du client exigeant", group: "comportementale" }), "catégorie de l'analyse");
  assert.ok(!isBehaviouralKeyword({ keyword: "Docker", group: "technique" }));
  assert.ok(!isBehaviouralKeyword({ keyword: "Communication", group: "mise_en_avant" }), "un métier, pas une qualité");
  const cv = withSkills(profile("tech-stage-fr"), ["Autonomie", "Rigueur"]);
  const s = offerKeywordScore(cv, linked(cv, detail(["Autonomie", "Rigueur", "Docker", "Kafka"])));
  assert.equal(s.counted, 2);
  assert.deepEqual(s.found, []);
});

test("mots-clés ignorés : retirés du score", () => {
  const keywords = offerScoreKeywords({ kind: "keywords", keywords: [{ keyword: "Docker", group: "technique", variants: [], weight: 1 }, { keyword: "Kafka", group: "technique", variants: [], weight: 1 }], ignored: ["kafka"], conseils: [], titre_cv: "", cvText: null });
  assert.deepEqual(keywords.map((k) => k.keyword), ["Docker"]);
});

test("toutes les voies du score passent par scoringOfferFor (mots-clés de la candidature liée)", () => {
  const source = readFileSync(new URL("./cv-score-context.ts", import.meta.url), "utf8");
  assert.match(source, /loadScoringContext\(data, scoringOfferFor\(applicationId, offerDetail\)\)/);
});
