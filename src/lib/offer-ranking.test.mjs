// « Trouver une offre » (lot 8c) : classement en trois rangs par mot-clé, tri par défaut,
// arrivée sur /offres sans recherche. Lancé par `npm test`.
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
const { compareOffers, keywordGroups, keywordRank } = await import("./offer-sort.ts");

const read = (path) => readFileSync(new URL(path, SRC), "utf8");
let id = 0;
const offer = (title, description = "", publishedAt = "2026-11-20T10:00:00Z") => ({
  id: `o${id++}`,
  title,
  company: "Entreprise",
  description,
  publishedAt,
  location: "Lyon",
  contract: null,
  url: "https://exemple.fr",
  source: "france-travail",
});

// Cas réel : « policier » → France Travail ramène aussi « police (d'assurance) ».
const banquier = offer("Banquier Privé H/F", "Gestion de patrimoine, polices d'assurance vie.", "2026-11-20T12:00:00Z");
const audit = offer("Manager Audit (H/F)", "Audit financier, revue des polices et contrats.", "2026-11-20T11:00:00Z");
const municipal = offer("Policier municipal (H/F)", "Missions de police de proximité.", "2026-11-18T09:00:00Z");
const adjoint = offer("Agent de sécurité", "Poste ouvert aux anciens policiers et gendarmes.", "2026-11-19T09:00:00Z");
const ancienPolicier = offer("Policier adjoint", "Brigade de nuit.", "2026-10-01T09:00:00Z");

test("rang : intitulé (2), description (1), aucun (0)", () => {
  const groups = keywordGroups("policier");
  assert.equal(keywordRank(groups, municipal), 2);
  assert.equal(keywordRank(groups, adjoint), 1, "« policiers » dans la description : rang 1");
  assert.equal(keywordRank(groups, banquier), 0);
  assert.equal(keywordRank(groups, audit), 0);
  assert.equal(keywordRank(keywordGroups("audit"), audit), 2);
  assert.equal(keywordRank(keywordGroups("patrimoine"), banquier), 1);
  assert.equal(keywordRank([], banquier), 2, "sans mot-clé, tout le monde au même rang");
});

test("« policier » : les intitulés qui correspondent passent devant, quel que soit le tri", () => {
  const offers = [banquier, audit, adjoint, municipal, ancienPolicier];
  for (const sort of ["recent", "ancien", "pertinence"]) {
    const sorted = [...offers].sort(compareOffers(sort, "policier"));
    const titles = sorted.map((o) => o.title);
    assert.deepEqual(new Set(titles.slice(0, 2)), new Set(["Policier municipal (H/F)", "Policier adjoint"]), sort);
    // Rang « aucun » gardé, en fin de liste.
    assert.equal(sorted.length, offers.length, sort);
    // Puis la description (« policiers »), puis le rang « aucun ».
    assert.equal(titles[2], "Agent de sécurité", sort);
    assert.deepEqual(new Set(titles.slice(3)), new Set(["Banquier Privé H/F", "Manager Audit (H/F)"]), sort);
  }
  // Dans un même rang, le tri choisi s'applique (le plus récent d'abord).
  const recent = [...offers].sort(compareOffers("recent", "policier")).map((o) => o.title);
  assert.deepEqual(recent.slice(0, 2), ["Policier municipal (H/F)", "Policier adjoint"]);
  const oldest = [...offers].sort(compareOffers("ancien", "policier")).map((o) => o.title);
  assert.deepEqual(oldest.slice(0, 2), ["Policier adjoint", "Policier municipal (H/F)"]);
});

test("sans mot-clé : uniquement le tri par date (dernières offres, recommandations sans mots)", () => {
  const sorted = [municipal, banquier, ancienPolicier].sort(compareOffers("recent", ""));
  assert.deepEqual(sorted.map((o) => o.title), ["Banquier Privé H/F", "Policier municipal (H/F)", "Policier adjoint"]);
});

test("tri par défaut : « pertinence » dès qu'un mot-clé est tapé sans tri choisi, et il n'est écrit dans l'adresse que s'il est choisi", () => {
  const offers = read("lib/offers.ts");
  assert.match(offers, /export const defaultOfferSort = \(keywords: string\): OfferSort => \(keywords\.trim\(\) \? "pertinence" : "recent"\);/);
  assert.match(offers, /sort: sortChosen \? \(params\.tri as OfferSort\) : defaultOfferSort\(keywords\),/);
  assert.match(offers, /if \(query\.sortChosen\) params\.set\("tri", query\.sort\);/);
  // France Travail : « pertinence » → son propre tri par pertinence (sort=0).
  assert.match(read("lib/france-travail.ts"), /sort: search\.sort === "pertinence" \? "0" : "1"/);
  // Le menu de tri n'est envoyé que s'il a été choisi (sinon une nouvelle recherche garde le défaut).
  const select = read("components/offers/sort-select.tsx");
  assert.match(select, /name=\{chosen \? "tri" : undefined\}/);
  assert.match(select, /e\.currentTarget\.name = "tri";\s*e\.currentTarget\.form\?\.requestSubmit\(\);/);
  assert.match(read("app/(app)/offres/page.tsx"), /<SortSelect defaultValue=\{sort\} chosen=\{manualQuery\.sortChosen\} \/>/);
});

test("arrivée sans recherche : recommandations si le métier du dernier CV est connu, sinon dernières offres", () => {
  const page = read("app/(app)/offres/page.tsx");
  assert.match(page, /const cvTargetJob = configured && !hasManualSearch && !recoOff \? await latestCvTargetJob\(\) : null;/);
  assert.match(page, /const wantsReco = configured && !hasManualSearch && \(explicitReco \|\| \(!recoOff && cvTargetJob !== null\)\);/);
  assert.match(page, /getRecommendationBasis\(recentSearches, cvTargetJob\)/);
  assert.match(page, /const showingLatest = configured && !hasManualSearch && !recommending;/);
  assert.match(page, /result = await searchLatestOffers\(page\);/);
  assert.match(page, /Dernières offres publiées · /);
  // Métier : celui du dernier CV (poste visé, sinon intitulé), sans échec.
  assert.match(page, /targetJobOf\(cv\.data\) \|\| cv\.data\.personal\.jobTitle/);
  // Le métier du CV entre dans les recommandations (comme une candidature récente).
  assert.match(read("lib/offer-recommendations.ts"), /\{ title: cvTargetJob\.trim\(\), location: "", contract: contractIn\(cvTargetJob\), weight: 1, ageMs: 0 \}/);
  // Recommandations coupées : ?reco=0, gardé dans la pagination ; la préférence n'est enregistrée que par un lien.
  const toggle = read("components/offers/recommendations-toggle.tsx");
  assert.match(toggle, /else if \(active\) router\.push\("\/offres\?reco=0", \{ scroll: false \}\);/);
  assert.match(toggle, /if \(active && fromLink && !readPreference\(\)\) savePreference\(true\);/);
});

test("dernières offres : 15 minutes de cache par source, une source en panne jamais mise en cache, les autres affichées", () => {
  const offers = read("lib/offers.ts");
  assert.match(offers, /export const LATEST_OFFERS_REVALIDATE = 15 \* 60;/);
  assert.match(offers, /unstable_cache\(\s*\(page: number\) => searchFranceTravail\(latestOffersSearch\(page\)\),\s*\["offres-dernieres-france-travail"\],\s*\{ revalidate: LATEST_OFFERS_REVALIDATE \},/);
  assert.match(offers, /unstable_cache\(\s*\(page: number\) => searchAdzuna\(latestOffersSearch\(page\)\),\s*\["offres-dernieres-adzuna"\],/);
  assert.match(offers, /if \(isAdzunaConfigured\(\)\) sources\.push\(\["adzuna", \(search\) => latestAdzuna\(search\.page\)\]\);/);
  assert.match(offers, /sources\.push\(\["job-boards", searchJobBoards\]\);\s*return searchAllOffers\(latestOffersSearch\(page\), sources\);/);
  // Même mélange que les recherches : source en panne → message habituel, autres sources gardées.
  assert.match(offers, /Promise\.allSettled\(sources\.map/);
  assert.match(offers, /momentanément indisponibles/);
});

test("délai maximal des sources externes : 8 s, puis source traitée comme indisponible", () => {
  assert.match(read("lib/offer-types.ts"), /export const SOURCE_TIMEOUT_MS = 8000;/);
  assert.equal((read("lib/france-travail.ts").match(/signal: AbortSignal\.timeout\(SOURCE_TIMEOUT_MS\)/g) ?? []).length, 2);
  assert.equal((read("lib/adzuna.ts").match(/signal: AbortSignal\.timeout\(SOURCE_TIMEOUT_MS\)/g) ?? []).length, 1);
});

const { LOCATION_MAX_AGE_DAYS, isLocationRecent, shouldFallBackToLatest } = await import("./offer-reco-rules.ts");
const { OFFERS_LUMEO_TEXTS } = await import("./lumeo-texts.ts");

test("lot 8e : recommandations à 0 offre → dernières offres publiées (sauf panne de France Travail)", () => {
  assert.equal(shouldFallBackToLatest({ total: 0, failed: [] }), true);
  assert.equal(shouldFallBackToLatest({ total: 0, failed: ["adzuna"] }), true, "Adzuna seule en panne : bascule quand même");
  assert.equal(shouldFallBackToLatest({ total: 0, failed: ["france-travail"] }), false, "pas de seconde attente");
  assert.equal(shouldFallBackToLatest({ total: 0, failed: ["france-travail", "adzuna"] }), false);
  assert.equal(shouldFallBackToLatest({ total: 3, failed: [] }), false, "des recommandations : pas de bascule");
  assert.equal(shouldFallBackToLatest(null), false, "recherche en échec : message habituel");
  const page = read("app/(app)/offres/page.tsx");
  assert.match(page, /if \(recommending && shouldFallBackToLatest\(result\)\) \{\s*try \{\s*const latest = await searchLatestOffers\(page\);/);
  assert.match(page, /<LumeoAvatar size=\{36\} expression="reflechit" standalone \/>\s*<p[^>]*>\{OFFERS_LUMEO_TEXTS\.recoEmpty\}<\/p>/);
  assert.match(page, /\(showingLatest \|\| recoFallback\) && \(/);
  // ?reco=0 : jamais de recommandations, donc jamais cette bascule ni la phrase de Lumeo.
  assert.match(page, /const wantsReco = configured && !hasManualSearch && \(explicitReco \|\| \(!recoOff && cvTargetJob !== null\)\);/);
  assert.match(page, /const recommending = wantsReco && \(explicitReco \|\| basis !== null\);/);
  assert.match(read("lib/offers.ts"), /failed: failures\.map\(\(f\) => f\.source\),/);
  assert.equal(OFFERS_LUMEO_TEXTS.recoEmpty, "Je n'ai rien trouvé qui te corresponde pour l'instant. Voici les dernières offres publiées.");
  assert.doesNotMatch(OFFERS_LUMEO_TEXTS.recoEmpty, /\d|illimit|\bvous\b/i);
});

test("lot 8e : lieu des recommandations retenu seulement s'il a 30 jours au plus", () => {
  const day = 86_400_000;
  assert.equal(LOCATION_MAX_AGE_DAYS, 30);
  assert.equal(isLocationRecent(0), true);
  assert.equal(isLocationRecent(30 * day), true);
  assert.equal(isLocationRecent(31 * day), false);
  assert.equal(isLocationRecent(Number.NaN), false, "date illisible : lieu ignoré");
  const reco = read("lib/offer-recommendations.ts");
  assert.match(reco, /\.filter\(\(source\) => isLocationRecent\(source\.ageMs\)\)\s*\.map\(\(source\) => \(\{ value: source\.location/);
  // Le métier compte toujours, quel que soit l'âge (pas de filtre sur les intitulés).
  assert.match(reco, /const titles = byWeight\(\s*sources\s*\.map\(\(source\) => \(\{ value: titleKeywords\(source\.title\)/);
});
