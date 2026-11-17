// Lot score (S7) : refuser n'est jamais rentable. Catégorie calculée sur les mots-clés restants,
// puis plafonnée à 12 + 8 × (restants / comptés avant refus). Tests de propriété sur toutes les
// combinaisons (présent, absent, refusé) jusqu'à 6 mots-clés, et non-régression sans refus sur
// les 13 paires du banc. Lancé par `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

await import("../../scripts/eval/register.mjs");
const { CvDataSchema } = await import("./cv-builder-types.ts");
const { offerKeywordScore, offerKeywordsCap, offerKeywordsCapLine, offerKeywordsLine, scoreCv } = await import("./cv-score.ts");
const { scoringContextFrom } = await import("./cv-scoring-context.ts");
const { scoringOfferFor } = await import("./cv-sector-context.ts");
const { loadFixtures } = await import("../../scripts/eval/fixtures.ts");

const FIXTURES = new URL("../../scripts/eval/fixtures/", import.meta.url);
const base = CvDataSchema.parse(JSON.parse(readFileSync(new URL("profiles/dev/tech-stage-fr.json", FIXTURES), "utf8")).cv);
const names = (n) => Array.from({ length: n }, (_, i) => `Zq${i + 1}x`);
const PRESENT = 0, MISSING = 1, REFUSED = 2;

/** Catégorie pour un état de chaque mot-clé : présent (dans le CV), absent, refusé (et absent). */
function category(states) {
  const keys = names(states.length);
  const cv = { ...base, skills: keys.filter((_, i) => states[i] === PRESENT).map((name, i) => ({ id: `s${i}`, name, level: "" })) };
  const context = { sector: "tech", offerKeywords: keys.map((keyword, i) => ({ keyword, variants: [], ...(states[i] === REFUSED ? { refused: true } : {}) })) };
  return offerKeywordScore(cv, context);
}
function* allStates(n) {
  for (let code = 0; code < 3 ** n; code++) yield Array.from({ length: n }, (_, i) => Math.floor(code / 3 ** i) % 3);
}

test("(a) écrire un mot-clé de l'offre de plus ne fait jamais baisser la catégorie", () => {
  for (let n = 1; n <= 6; n++) {
    for (const states of allStates(n)) {
      const before = category(states).points;
      states.forEach((state, i) => {
        if (state === PRESENT) return;
        const after = category(states.map((s, j) => (j === i ? PRESENT : s))).points;
        assert.ok(after >= before - 1e-9, `n=${n} ${states} → mot-clé ${i} écrit : ${before} → ${after}`);
      });
    }
  }
});

test("(b) refuser un mot-clé absent ne donne jamais plus que le plafond", () => {
  for (let n = 1; n <= 6; n++) {
    for (const states of allStates(n)) {
      const s = category(states);
      const remaining = states.filter((x) => x !== REFUSED).length;
      assert.ok(s.points <= offerKeywordsCap(remaining, n) + 1e-9, `n=${n} ${states}`);
      assert.equal(s.cap, offerKeywordsCap(remaining, n));
    }
  }
  assert.equal(offerKeywordsCap(8, 8), 20, "sans refus : plafond 20");
  assert.equal(offerKeywordsCap(0, 8), 12, "tout refusé : 12");
});

test("(c) 1 trouvé + tous les autres refusés ≤ plafond (13 pour 8 mots-clés), sous le 20 d'avant S7", () => {
  const one = category([PRESENT, ...Array(7).fill(REFUSED)]);
  assert.equal(one.cap, 13);
  assert.equal(one.points, 13);
  assert.equal(one.capped, true);
  assert.equal(category(Array(8).fill(REFUSED)).points, 12);
  assert.match(offerKeywordsCapLine(one), /^Plafond de 13 points sur 20 : 7 mots-clés retirés parce que tu as dit ne pas les avoir\./);
  assert.equal(offerKeywordsCapLine(category([PRESENT, MISSING, MISSING])), null, "sans refus : aucune explication");
});

test("(d) sans refus : score identique à avant S7 sur les 13 paires du banc", () => {
  const BEFORE_S7 = { O01: 52, O02: 48, O03: 39, O04: 51, O05: 80, O06: 59, O07: 55, O08: 52, O09: 77, O10: 53, H08: 64, H09: 50, H10: 61 };
  const fx = loadFixtures();
  const pairs = fx.scenarios.filter((s) => s.case === "lie");
  assert.equal(pairs.length, 13);
  for (const s of pairs) {
    const p = fx.profiles.get(s.profile);
    const o = fx.offers.get(s.offer);
    const offer = scoringOfferFor(o.detail.application.id, o.detail);
    const sector = scoringContextFrom(p.cv, offer, []).sector;
    const score = scoreCv(p.cv, scoringContextFrom(p.cv, offer, fx.marketKeywords[sector] ?? [])).score;
    assert.equal(score, BEFORE_S7[s.id.slice(0, 3)], s.id);
  }
});

test("Lumeo, onglet et score : même ligne « Mots-clés de l'offre : N sur M visés »", () => {
  const fx = loadFixtures();
  const p = fx.profiles.get("commercial-junior-fr");
  const o = fx.offers.get("o-tech-java-senior");
  const scoring = scoringContextFrom(p.cv, scoringOfferFor(o.detail.application.id, o.detail), []);
  const line = offerKeywordsLine(offerKeywordScore(p.cv, scoring));
  // Lumeo lit les messages des corrections de scoreCv ; l'onglet, offerKeywordsLine(offerKeywordScore).
  assert.equal(scoreCv(p.cv, scoring).corrections.find((c) => c.category === "keywords").message, line);
  const lumeo = readFileSync(new URL("../app/actions/lumeo.ts", import.meta.url), "utf8");
  assert.match(lumeo, /const context = await loadBuilderCvScoring\(cv\.data, cv\.applicationId/);
  assert.match(lumeo, /const weakPoints = score\.corrections\.map\(\(c\) => c\.message\)/);
  const editor = readFileSync(new URL("../components/cv-builder/cv-builder-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /summary=\{offerScore && offerKeywordsLine\(offerScore\)\}/);
});
