// Lot 10a : « Bravo » honnête (ton selon le score du CV), variété des recommandations, case
// « Recommandations » (l'adresse prime). Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../", import.meta.url);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (spec.startsWith("@/")) {
      const file = fileURLToPath(new URL(`${spec.slice(2)}.ts`, SRC));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if (/^\.\.?\/[^.]*$/.test(spec)) return next(`${spec}.ts`, ctx);
    return next(spec, ctx);
  },
});
const { bravoTone } = await import("./guide-bravo-tone.ts");
const { READY_SCORE } = await import("./cv-score.ts");
const { spreadRepeats, MAX_SAME_OFFER_PER_PAGE } = await import("./offer-merge.ts");
const { GUIDE_TEXTS } = await import("./lumeo-texts.ts");
const read = (path) => readFileSync(new URL(path, SRC), "utf8");

test("A : ton de « Bravo » selon le seuil existant, repli « bon début » sans score", () => {
  assert.equal(bravoTone(READY_SCORE), "bravo");
  assert.equal(bravoTone(100), "bravo");
  assert.equal(bravoTone(READY_SCORE - 1), "debut");
  assert.equal(bravoTone(5), "debut", "CV à 5/100 : pas de félicitations");
  assert.equal(bravoTone(null), "debut");
  assert.equal(bravoTone(undefined), "debut");
  assert.equal(bravoTone(Number.NaN), "debut");
  // Seuil lu dans la constante, jamais en dur.
  assert.match(read("lib/guide-bravo-tone.ts"), /score >= READY_SCORE/);
  assert.doesNotMatch(read("lib/guide-bravo-tone.ts"), /\b80\b/);
});

test("A : score recalculé côté serveur à l'arrivée sur « Bravo », sans échec, rien dans l'adresse", () => {
  const server = read("lib/guide-bravo.ts");
  assert.match(server, /const context = await loadBuilderCvScoring\(cv\.data, cv\.applicationId\);\s*return bravoTone\(scoreCv\(cv\.data, context\)\.score\);/);
  assert.match(server, /catch \(error\) \{[\s\S]*?return bravoTone\(null\);/);
  const page = read("app/(onboarding)/bienvenue/page.tsx");
  assert.match(page, /<GuideOfferScreen\s+bravo=\{bravo\}\s+tone=\{bravo \? await loadBravoTone\(\) : "debut"\}/);
  // Le score n'est jamais transmis par l'adresse.
  assert.match(read("components/cv-builder/cv-builder-editor.tsx"), /router\.push\("\/bienvenue\?etape=bravo"\);/);
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /const ready = tone === "bravo";/);
  assert.match(flow, /\{ready && <Confetti \/>\}/);
  assert.match(flow, /expression="felicite" celebrate standalone[\s\S]{0,120}expression="content" standalone/);
  assert.match(flow, /ready \? GUIDE_TEXTS\.bravo\.title : GUIDE_TEXTS\.bravo\.startTitle/);
  assert.match(flow, /ready \? GUIDE_TEXTS\.bravo\.subtitle : GUIDE_TEXTS\.bravo\.startSubtitle/);
});

test("A : textes de Lumeo (tutoiement, sans chiffre ni emoji)", () => {
  assert.equal(GUIDE_TEXTS.bravo.startTitle, "Ton premier CV est enregistré.");
  assert.equal(
    GUIDE_TEXTS.bravo.startSubtitle,
    "C'est un bon début, tu pourras l'améliorer quand tu veux. Et si on cherchait ta première candidature ?",
  );
  for (const text of [GUIDE_TEXTS.bravo.startTitle, GUIDE_TEXTS.bravo.startSubtitle]) {
    assert.doesNotMatch(text, /\d|\p{Extended_Pictographic}|\bvous\b|illimit/iu);
  }
});

let n = 0;
const offer = (company, title) => ({ id: `o${n++}`, title, company, description: "", publishedAt: "2026-11-20T10:00:00Z", location: "", contract: null, url: "https://exemple.fr", source: "france-travail" });

test("C : au plus 2 cartes par employeur et intitulé en tête de page, rien de perdu", () => {
  assert.equal(MAX_SAME_OFFER_PER_PAGE, 2);
  const efc = Array.from({ length: 4 }, () => offer("EFC", "Analyste financier / financière (H/F)"));
  const other = [offer("PI2C", "Analyste financier"), offer("RATP", "Analyste financier")];
  const page = [efc[0], efc[1], efc[2], other[0], efc[3], other[1]];
  const spread = spreadRepeats(page);
  assert.deepEqual(spread.map((o) => o.id), [efc[0], efc[1], other[0], other[1], efc[2], efc[3]].map((o) => o.id));
  assert.equal(spread.length, page.length, "aucune offre perdue");
  // Même intitulé, employeurs différents : pas un doublon.
  const distinct = [offer("A", "Comptable"), offer("B", "Comptable"), offer("C", "Comptable")];
  assert.deepEqual(spreadRepeats(distinct), distinct);
  // Page entièrement d'un même employeur : rien de perdu, ordre gardé.
  assert.deepEqual(spreadRepeats(efc), efc);
});

test("C : recommandations triées par pertinence et plafonnées ; recherche manuelle inchangée", () => {
  const page = read("app/(app)/offres/page.tsx");
  assert.match(page, /sort: "pertinence",\s*sortChosen: false,\s*page: manualQuery\.page,/);
  assert.match(page, /if \(result && \(recommending \|\| showingLatest\)\) result = \{ \.\.\.result, offers: spreadRepeats\(result\.offers\) \};/);
  assert.equal((page.match(/spreadRepeats\(/g) ?? []).length, 1, "seul usage : jamais en recherche manuelle");
});

test("D : ?reco=0 / ?reco=1 dans l'adresse priment sur la préférence enregistrée", () => {
  const toggle = read("components/offers/recommendations-toggle.tsx");
  assert.match(toggle, /const enabled = active \|\| \(!urlChoice && stored\);/);
  assert.match(read("app/(app)/offres/page.tsx"), /urlChoice=\{explicitReco \|\| recoOff\}/);
  // Table de vérité de la règle : ?reco=0 avec une préférence à « 1 » → case décochée.
  const enabled = ({ active, urlChoice, stored }) => active || (!urlChoice && stored);
  assert.equal(enabled({ active: false, urlChoice: true, stored: true }), false, "?reco=0, préférence « 1 »");
  assert.equal(enabled({ active: true, urlChoice: true, stored: false }), true, "?reco=1");
  assert.equal(enabled({ active: false, urlChoice: false, stored: true }), true, "sans paramètre : préférence");
});
