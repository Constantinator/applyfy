// Verbes d'action (lot « le coach écoute ») : liste commune à tous les secteurs, verbes et noms
// ajoutés, tournures fidèles (« Participation à… ») avec un complément précis ; scores des CV de
// test figés (non-régression). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json")) {
      return { format: "module", source: `export default ${readFileSync(new URL(url), "utf8")};`, shortCircuit: true };
    }
    return next(url, ctx);
  },
});

const { actionDetector, scoreCv } = await import("./cv-score.ts");
const { COMMON_ACTION_VERBS, SECTORS, cvScoringSector } = await import("./cv-sector-context.ts");
const { scoringContextForSector } = await import("./cv-scoring-context.ts");
const { CvDataSchema, chatContent, targetJobOf } = await import("./cv-builder-types.ts");

const isAction = actionDetector(COMMON_ACTION_VERBS);

test("verbes : actions courantes acceptées dans tous les secteurs (FR et EN)", () => {
  for (const text of [
    "Correction d'une vingtaine de bugs sur l'application web",
    "Corrigé une vingtaine de bugs",
    "Transmettre l'état des patients et les soins réalisés",
    "Transmission de l'état des patients à chaque prise de poste",
    "Accueil d'une dizaine de nouveaux arrivants",
    "Présélection des candidats pour 25 recrutements",
    "Tri des candidatures pour 25 recrutements",
    "Assurer les transmissions de 12 patients",
    "Prise en charge de 12 patients en moyenne par poste",
    "Résolution de 30 incidents par mois",
    "Maintenance des bases de données PostgreSQL",
    "Soutien à 3 équipes commerciales",
    "Cut API response time by 40%",
    "Maintained the PostgreSQL databases",
    "Fixed around 20 bugs",
  ]) {
    assert.ok(isAction(text), text);
  }
});

test("verbes : tournures fidèles acceptées seulement avec un complément d'au moins 3 mots", () => {
  for (const text of [
    "Participation à 6 missions de commissariat aux comptes",
    "Participation aux transmissions de l'état des patients",
    "Contribution à la refonte du site e-commerce",
    "Appui à la direction financière du groupe",
    "Participated in the migration of 12 services",
  ]) {
    assert.ok(isAction(text), text);
  }
  for (const text of [
    "Participation aux réunions d'équipe",
    "Participation aux transmissions",
    "Contribution au projet",
    "Appui à l'équipe",
    "Participation",
    "Contributed to the project",
  ]) {
    assert.ok(!isAction(text), text);
  }
});

test("verbes : restent refusés (pas une action)", () => {
  for (const text of ["Tenue du standard téléphonique", "Aide au recrutement", "Responsable de 12 projets", "Tâches administratives diverses"]) {
    assert.ok(!isAction(text), text);
  }
});

test("verbes : la même règle dans tous les secteurs (liste commune du contexte du score)", () => {
  const lists = SECTORS.map((s) => scoringContextForSector(s, null, []).actionVerbs);
  for (const list of lists) assert.deepEqual(list, COMMON_ACTION_VERBS);
  // « Participation… » ne dépend plus du secteur (avant : acceptée en santé seulement).
  for (const sector of SECTORS) {
    const detector = actionDetector(scoringContextForSector(sector, null, []).actionVerbs);
    assert.equal(detector("Participation aux réunions d'équipe"), false, sector);
    assert.equal(detector("Participation à 6 missions de commissariat aux comptes"), true, sector);
  }
});

// Scores des CV de test du banc d'essai (scripts/eval/fixtures), avec ses mots-clés du marché
// figés : la nouvelle règle les change de -5 à +6 points (moyenne +1,8) ; aucun ne passe 80.
const EXPECTED = {
  "commercial-junior-fr": 45,
  "conseil-confirme-fr": 85,
  "finance-junior-fr": 54,
  "marketing-junior-fr": 63,
  "rh-stage-fr": 56,
  "sante-junior-fr": 53,
  "tech-confirme-en": 73,
  "tech-stage-fr": 59,
  "creatif-confirme-fr": 66,
  "etudiant-stage-fr": 62,
  "finance-confirme-en": 50,
  "luxe-junior-fr": 65,
};

test("non-régression : scores des 12 CV de test", () => {
  const fixtures = new URL("../../scripts/eval/fixtures/", import.meta.url);
  const market = JSON.parse(readFileSync(new URL("market-keywords.json", fixtures), "utf8"));
  const seen = {};
  for (const set of ["dev", "holdout"]) {
    for (const file of readdirSync(new URL(`profiles/${set}/`, fixtures))) {
      const cv = CvDataSchema.parse(JSON.parse(readFileSync(new URL(`profiles/${set}/${file}`, fixtures), "utf8")).cv);
      const sector = cvScoringSector(JSON.stringify(chatContent(cv)), targetJobOf(cv), null);
      seen[file.replace(".json", "")] = scoreCv(cv, scoringContextForSector(sector, null, market[sector] ?? [])).score;
    }
  }
  assert.deepEqual(seen, EXPECTED);
});
