// Lot 9 : mélange des sources de « Trouver une offre » (doublons entre sources seulement) et
// verrou de la phase guidée sur le formulaire de candidature. Lancé par `npm test`.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../", import.meta.url);
const STUBS = {
  "server-only": "",
  "next/cache": "export const unstable_cache = (fn) => fn;",
  "next/headers": "export const cookies = async () => ({ get: () => undefined }); export const headers = async () => new Headers();",
};
registerHooks({
  resolve(spec, ctx, next) {
    if (spec in STUBS) return { url: `data:text/javascript,${encodeURIComponent(STUBS[spec])}`, shortCircuit: true };
    if (spec.startsWith("@/")) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const file = fileURLToPath(new URL(`${spec.slice(2)}${ext}`, SRC));
        if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }
    if (/^\.\.?\/[^.]*$/.test(spec)) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return next(`${spec}.ts`, ctx);
    }
    return next(spec, ctx);
  },
});
const { mergeSourceOffers } = await import("./offer-merge.ts");
const { guidedOfferPhase, guideOfferDestination, ONBOARDING_LAUNCHED_AT } = await import("./onboarding.ts");

const read = (path) => readFileSync(new URL(path, SRC), "utf8");
let n = 0;
const offer = (source, title = "Analyste financier / financière (H/F)", company = "EFC", location = "13 - Marseille") => ({
  id: `${source}-${n++}`,
  title,
  company,
  description: "",
  publishedAt: "2026-11-20T10:00:00Z",
  location,
  contract: "CDI",
  url: "https://exemple.fr",
  source,
});

test("même intitulé chez le même employeur dans une même source : annonces distinctes, toutes affichées", () => {
  const ft = Array.from({ length: 10 }, (_, i) => offer("france-travail", undefined, undefined, `Région ${i}`));
  assert.equal(mergeSourceOffers([{ offers: ft }, { offers: [] }]).length, 10, "une page = 10 cartes, pas 1");
  // Compteur et pages inchangés (« 184 offres · Page 1 sur 19 ») : total des sources, 10 par page.
  const offers = read("lib/offers.ts");
  assert.match(offers, /const offers = mergeSourceOffers\(results\);\s*offers\.sort\(compareOffers/);
  assert.match(offers, /total: results\.reduce\(\(sum, r\) => sum \+ r\.total, 0\),\s*pageCount: Math\.ceil\(reachable \/ SOURCE_PAGE_SIZE\),/);
});

test("même offre reprise par Adzuna : une seule carte (celle de la première source)", () => {
  const merged = mergeSourceOffers([
    { offers: [offer("france-travail", "Comptable H/F", "ACME"), offer("france-travail", "Comptable H/F", "ACME")] },
    { offers: [offer("adzuna", "Comptable (H/F)", "Acme"), offer("adzuna", "Juriste", "ACME")] },
  ]);
  assert.equal(merged.length, 3, merged.map((o) => `${o.source}:${o.title}`).join(", "));
  assert.equal(merged.filter((o) => o.source === "france-travail").length, 2, "les deux annonces France Travail restent");
  assert.deepEqual(merged.filter((o) => o.source === "adzuna").map((o) => o.title), ["Juriste"]);
  // À tour de rôle : une offre de chaque source.
  assert.deepEqual(merged.map((o) => o.source), ["france-travail", "france-travail", "adzuna"]);
});

const recent = new Date(Date.parse(ONBOARDING_LAUNCHED_AT) + 3_600_000).toISOString();
const base = {
  createdAt: recent,
  metadataCompleted: false,
  doneCookie: false,
  progress: { step: "guide_offre", completed: false },
  fromGuide: true,
};

test("verrou du formulaire de candidature : seulement étape guide_offre, compte récent, accueil=1", () => {
  assert.equal(guidedOfferPhase(base), true);
  assert.equal(guidedOfferPhase({ ...base, fromGuide: false }), false, "« Nouvelle candidature » : jamais");
  assert.equal(guidedOfferPhase({ ...base, createdAt: "2026-01-01T00:00:00Z" }), false, "ancien compte");
  assert.equal(guidedOfferPhase({ ...base, metadataCompleted: true }), false, "parcours terminé");
  assert.equal(guidedOfferPhase({ ...base, doneCookie: true }), false, "cookie de fin");
  assert.equal(guidedOfferPhase({ ...base, progress: { step: "guide_offre", completed: true } }), false);
  assert.equal(guidedOfferPhase({ ...base, progress: { step: "guide_cv", completed: false } }), false);
  assert.equal(guidedOfferPhase({ ...base, progress: { step: "guide_telecharger", completed: false } }), false);
  assert.equal(guidedOfferPhase({ ...base, progress: null }), false);
  assert.match(guideOfferDestination("https://exemple.fr/o"), /&accueil=1$/);
});

test("formulaire de candidature guidé : en-tête guidé, retour masqué, « Annuler » vers l'offre, accueil=1 gardé", () => {
  const page = read("app/(app)/candidatures/nouvelle/page.tsx");
  assert.match(page, /const guided = await getGuidedOfferStep\(accueil === "1"\);/);
  assert.match(page, /\{guided && <GuidedPageHeader step="guide_offre" \/>\}/);
  assert.match(page, /\{!guided && \(\s*<Link\s+href="\/candidatures"[\s\S]*?Retour aux candidatures/);
  assert.match(page, /cancelHref=\{guided \? "\/bienvenue" : "\/candidatures"\}/);
  assert.match(page, /<ClearSearchParams keep=\{accueil === "1" \? "accueil=1" : ""\} \/>/);
  assert.match(read("components/application/new-application-form.tsx"), /href=\{cancelHref\}[\s\S]{0,80}Annuler/);
  assert.match(read("components/clear-search-params.tsx"), /keep \? `\$\{window\.location\.pathname\}\?\$\{keep\}` : window\.location\.pathname/);
  // Même verrou que l'import : barre et bouton rond (data-app-chrome) masqués, pied de page réduit,
  // « Passer » termine l'étape guide_offre.
  const header = read("components/onboarding/guided-page-header.tsx");
  assert.match(header, /step: GuideEditorStep \| "guide_offre"/);
  assert.match(header, /\[data-app-chrome\]\{display:none!important\}/);
  assert.match(header, /<GuidedFooterStyle \/>/);
  assert.match(header, /finishGuideAction\(step\)/);
  assert.match(read("app/actions/onboarding.ts"), /skippedStep === "guide_offre" \? skippedStep : null/);
  const server = read("lib/onboarding-server.ts");
  assert.match(server, /export async function getGuidedOfferStep\(fromGuide: boolean\): Promise<boolean> \{\s*if \(!fromGuide\) return false;/);
});
