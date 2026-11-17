// Score et langue (lot traduction, C2) : un CV traduit (français <-> anglais) garde sa note.
// Équivalents des mots-clés (cv-keyword-aliases.ts), verbes anglais, longueur visée selon la
// langue. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { actionDetector, keywordAliasesOf, scoreCv } = await import("./cv-score.ts");
const { COMMON_ACTION_VERBS } = await import("./cv-sector-context.ts");
const { normalizeText } = await import("./keyword-match.ts");
const { KEYWORD_ALIASES: aliases } = await import("./cv-keyword-aliases.ts");

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const FIXTURES = "../../scripts/eval/fixtures/";
const knowledge = json("./cv-knowledge-base.json").sectors;
const market = json(`${FIXTURES}market-keywords.json`);
const norm = (text) => normalizeText(text).trim();

function score(raw, sector) {
  const cv = CvDataSchema.parse(raw);
  const context = scoringContextFrom(cv, null, market[sector]);
  return { sector: context.sector, ...scoreCv(cv, context) };
}

test("CV traduits à la main : même secteur et même note dans les deux sens (écart de 2 points au plus)", () => {
  const pairs = [
    [json(`${FIXTURES}profiles/dev/finance-junior-fr.json`).cv, json(`${FIXTURES}translated/finance-junior-en.json`), "finance"],
    [json(`${FIXTURES}profiles/dev/tech-confirme-en.json`).cv, json(`${FIXTURES}translated/tech-confirme-fr.json`), "tech"],
  ];
  for (const [original, translated, sector] of pairs) {
    const before = score(original, sector);
    const after = score(translated, sector);
    assert.equal(after.sector, before.sector);
    assert.ok(Math.abs(after.score - before.score) <= 2, `${sector} : ${before.score} → ${after.score}`);
    const keywords = (s) => s.categories.find((c) => c.id === "keywords").score;
    assert.equal(keywords(after), keywords(before), `${sector} : mots-clés`);
  }
});

test("équivalents : les 10 secteurs de la base sont couverts", () => {
  assert.deepEqual(Object.keys(aliases).sort(), Object.keys(knowledge).sort());
  assert.deepEqual(Object.keys(aliases).sort(), ["commercial", "conseil", "creatif", "etudiant", "finance", "luxe", "marketing", "rh", "sante", "tech"]);
});

test("équivalents : chaque mot-clé est un mot-clé du secteur, aucun équivalent n'en est déjà un (pas de double compte)", () => {
  for (const [sector, map] of Object.entries(aliases)) {
    const keywords = new Set([...knowledge[sector].ats_keywords, ...(market[sector] ?? [])].map(norm));
    for (const [keyword, list] of Object.entries(map)) {
      assert.ok(keywords.has(norm(keyword)), `${sector} : « ${keyword} » n'est pas un mot-clé du secteur`);
      assert.ok(list.length > 0, `${sector} : « ${keyword} » sans équivalent`);
      for (const alias of list) {
        assert.ok(!keywords.has(norm(alias)), `${sector} : « ${alias} » est déjà un mot-clé du secteur`);
        assert.notEqual(norm(alias), norm(keyword));
      }
    }
  }
});

test("équivalents : un mot-clé trouvé en anglais compte une fois, et seulement dans son secteur", () => {
  assert.deepEqual(keywordAliasesOf("Analyse financière", "finance"), ["financial analysis"]);
  assert.deepEqual(keywordAliasesOf("analyse financière", "tech"), []);
  const base = json(`${FIXTURES}profiles/dev/finance-junior-fr.json`).cv;
  const once = score({ ...base, skills: [{ id: "a", name: "Financial analysis", level: "" }] }, "finance");
  const twice = score({ ...base, skills: [{ id: "a", name: "Financial analysis", level: "" }, { id: "b", name: "Analyse financière", level: "" }] }, "finance");
  const kw = (s) => s.categories.find((c) => c.id === "keywords").score;
  assert.equal(kw(once), kw(twice));
});

test("verbes anglais d'un CV traduit reconnus, sans toucher les débuts de puce français", () => {
  const isAction = actionDetector(COMMON_ACTION_VERBS);
  for (const bullet of [
    "Drafted 12 credit memos",
    "Reviewed 30 contracts",
    "Monitored the client portfolio",
    "Conducted 6 audit engagements",
    "Execution of 4 transactions",
    "Oversaw a team of 5",
    "Reconciled 200 accounts per month",
    "Spearheaded the launch of 2 products",
    "Testing of internal controls",
  ]) {
    assert.ok(isAction(bullet), bullet);
  }
  for (const bullet of [
    "Performance commerciale de 120 %",
    "Savoir-faire artisanal",
    "Sécurité des données de 3 sites",
    "Service client multicanal",
    "Processus de recrutement",
    "Modèle de prévision",
  ]) {
    assert.equal(isAction(bullet), false, bullet);
  }
});

test("longueur visée selon la langue : 400 à 1 600 mots en français, 350 à 1 400 en anglais", () => {
  const fr = score(json(`${FIXTURES}profiles/dev/finance-junior-fr.json`).cv, "finance");
  const en = score(json(`${FIXTURES}translated/finance-junior-en.json`), "finance");
  assert.ok(fr.corrections.some((c) => /\(vise 400 à 1 600\)$/.test(c.message)));
  assert.ok(en.corrections.some((c) => /\(vise 350 à 1 400\)$/.test(c.message)));
});
