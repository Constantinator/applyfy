// Lot score (S2) : mots-clés de l'offre que le candidat dit ne pas avoir, relevés par le serveur
// (jamais par le modèle), enregistrés dans cv_suggestions.refused et retirés du score (sauf s'ils
// sont dans le CV) ; tous refusés : 12 sur 20. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { refusedOfferKeywords } = await import("./coach-intent.ts");
const { missingOfferKeywords, offerRefusals } = await import("./coach-context.ts");
const { ALL_REFUSED_POINTS, offerKeywordScore, offerKeywordsLine, scoreCv } = await import("./cv-score.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { scoringOfferFor } = await import("./cv-sector-context.ts");
const { readCvSuggestions } = await import("./cv-types.ts");

const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);
const baseCv = CvDataSchema.parse(JSON.parse(readFileSync(new URL("profiles/dev/tech-stage-fr.json", FIXTURES), "utf8")).cv);
const withSkills = (names) => ({ ...baseCv, skills: names.map((name, i) => ({ id: `s${i}`, name, level: "" })) });

function detail(keywords, refused = []) {
  return {
    application: {
      id: "app-1",
      position: "Développeur backend",
      company: "Éditeur Fictif",
      sector: "tech",
      offer_description: "API",
      cv_suggestions: {
        keywords: keywords.map((keyword, i) => ({ keyword, group: "technique", variants: [], weight: 10 - i })),
        ignored: [],
        refused,
        conseils: [],
        titre_cv: "",
        cvText: null,
      },
    },
  };
}
const scoringOf = (cv, d) => scoringContextFrom(cv, scoringOfferFor("app-1", d), []);
const question = (text) => [{ role: "assistant", content: text }];
const KEYWORDS = ["Docker", "Kubernetes", "Kafka", "PostgreSQL", "Java"];

test("refus détecté : « non » à une question du coach sur des mots-clés de l'offre", () => {
  const history = question("Bien noté. As-tu déjà utilisé Docker ou Kubernetes dans un projet ?");
  assert.deepEqual(refusedOfferKeywords(history, "Non.", KEYWORDS), ["Docker", "Kubernetes"]);
  assert.deepEqual(refusedOfferKeywords(history, "Non, jamais en entreprise.", KEYWORDS), ["Docker", "Kubernetes"]);
  assert.deepEqual(refusedOfferKeywords(question("Have you used Kafka?"), "No, I haven't.", KEYWORDS), ["Kafka"]);
});

test("refus détecté : phrase où le candidat dit ne pas avoir pratiqué un mot-clé", () => {
  assert.deepEqual(refusedOfferKeywords([], "Je n'ai jamais utilisé Kafka.", KEYWORDS), ["Kafka"]);
  assert.deepEqual(refusedOfferKeywords([], "Pas d'expérience en Java, désolé.", KEYWORDS), ["Java"]);
  assert.deepEqual(refusedOfferKeywords([], "Je ne connais pas Kubernetes mais j'ai fait du Docker.", KEYWORDS), ["Kubernetes"]);
  assert.deepEqual(refusedOfferKeywords([], "I've never used Kafka.", KEYWORDS), ["Kafka"]);
});

test("pas de refus : incertitude, autre question, mot-clé déjà là, réponse mitigée, sans question", () => {
  const history = question("As-tu déjà utilisé Docker dans un projet ?");
  assert.deepEqual(refusedOfferKeywords(history, "Je ne sais pas trop.", KEYWORDS), [], "incertitude");
  assert.deepEqual(refusedOfferKeywords(question("Combien de clients suivais-tu ?"), "Non.", KEYWORDS), [], "question de chiffre");
  assert.deepEqual(refusedOfferKeywords(history, "Je n'ai pas encore mis Docker dans mon CV.", KEYWORDS), [], "il l'a, pas dans le CV");
  assert.deepEqual(refusedOfferKeywords(history, "Je n'ai pas encore mis ça dans mon CV.", KEYWORDS), []);
  assert.deepEqual(refusedOfferKeywords(question("As-tu utilisé Docker ou Kubernetes ?"), "Docker oui, Kubernetes non.", KEYWORDS), [], "mitigée");
  assert.deepEqual(refusedOfferKeywords([], "Non.", KEYWORDS), [], "aucune question du coach");
  assert.deepEqual(refusedOfferKeywords(history, "Oui, sur mon projet de fin d'études.", KEYWORDS), []);
});

test("offerRefusals : ajoute aux refus connus, sans doublon ; null si rien de nouveau ou CV libre", () => {
  const d = detail(KEYWORDS, ["kafka"]);
  const result = offerRefusals(d, question("As-tu déjà utilisé Kafka ou Java ?"), "Non.");
  assert.deepEqual(result.added, ["Java"]);
  assert.deepEqual(result.suggestions.refused, ["kafka", "Java"]);
  assert.equal(offerRefusals(d, question("As-tu déjà utilisé Kafka ?"), "Non."), null, "déjà refusé");
  assert.equal(offerRefusals(null, question("As-tu déjà utilisé Kafka ?"), "Non."), null, "CV libre");
});

test("refus partiel : retiré du numérateur et du dénominateur", () => {
  const cv = withSkills(["Docker", "PostgreSQL"]);
  const before = offerKeywordScore(cv, scoringOf(cv, detail(KEYWORDS)));
  assert.deepEqual([before.found.length, before.counted, before.target], [2, 5, 3]);
  const after = offerKeywordScore(cv, scoringOf(cv, detail(KEYWORDS, ["Kafka", "Java"])));
  assert.deepEqual([after.found.length, after.counted, after.target], [2, 3, 2]);
  assert.deepEqual(after.refused, ["Kafka", "Java"]);
  assert.equal(after.points, 20);
});

test("refusé mais présent dans le CV : compte comme trouvé", () => {
  const cv = withSkills(["Docker"]);
  const s = offerKeywordScore(cv, scoringOf(cv, detail(KEYWORDS, ["Docker"])));
  assert.deepEqual(s.found, ["Docker"]);
  assert.deepEqual(s.refused, []);
  assert.equal(s.counted, 5);
});

test("tous refusés : 12 sur 20, ligne de détail, aucune correction de mots-clés", () => {
  const cv = withSkills(["React"]);
  const d = detail(KEYWORDS, KEYWORDS);
  const s = offerKeywordScore(cv, scoringOf(cv, d));
  assert.equal(s.allRefused, true);
  assert.equal(s.points, ALL_REFUSED_POINTS);
  assert.equal(ALL_REFUSED_POINTS, 12);
  const score = scoreCv(cv, scoringOf(cv, d));
  assert.equal(score.categories.find((c) => c.id === "keywords").score, 12);
  assert.equal(score.corrections.some((c) => c.category === "keywords"), false);
  assert.equal(offerKeywordsLine(s), "Mots-clés de l'offre : tous retirés (tu as dit ne pas les avoir), 12 points sur 20");
});

test("coach : un mot-clé refusé n'est plus proposé", () => {
  const cv = withSkills(["React"]);
  const missing = missingOfferKeywords(detail(KEYWORDS, ["Kafka"]), cv, "tech");
  assert.ok(!missing.includes("Kafka"));
  assert.ok(missing.includes("Docker"));
});

test("refus conservés : lecture, nouvelle analyse de l'offre et extraction", () => {
  assert.deepEqual(readCvSuggestions(detail(KEYWORDS, ["Kafka"]).application.cv_suggestions).refused, ["Kafka"]);
  assert.deepEqual(readCvSuggestions({ keywords: [], ignored: [] }).refused, [], "ancienne analyse : aucun refus");
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("app/actions/cv.ts"), /refused: previous\?\.kind === "keywords" \? previous\.refused : \[\]/);
  assert.match(read("lib/application-cv.ts"), /ignored: \[\], refused: \[\]/);
});

test("action : refus enregistrés par le serveur avant le contexte du coach, renvoyés à l'éditeur", () => {
  const source = readFileSync(new URL("../app/actions/cv-builder.ts", import.meta.url), "utf8");
  assert.match(source, /offerRefusals\(detail, turns, request\)/);
  assert.match(source, /saveCvSuggestions\(detail\.application\.id, refusal\.suggestions, \{ keepDate: true \}\)/);
  assert.ok(source.indexOf("offerRefusals(detail") < source.indexOf("coachContext(current, shown.applicationId, request, turns, detail)"));
});
