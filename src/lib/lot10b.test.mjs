// Lot 10b : 3 offres proposées sur l'écran de l'offre de la phase guidée, ajoutées en un clic.
// Lancé par `npm test`.
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
const { pickDistinctEmployers } = await import("./offer-merge.ts");
const { GUIDE_TEXTS } = await import("./lumeo-texts.ts");
const read = (path) => readFileSync(new URL(path, SRC), "utf8");

let n = 0;
const offer = (company, title = "Analyste financier") => ({ id: `o${n++}`, title, company, description: "", publishedAt: "", location: "Lyon", contract: null, url: "https://exemple.fr", source: "france-travail" });

test("3 offres d'employeurs différents si possible, complétées sinon", () => {
  const [e1, e2, e3, a, b] = [offer("EFC"), offer("efc"), offer("EFC"), offer("PI2C"), offer("RATP")];
  assert.deepEqual(pickDistinctEmployers([e1, e2, e3, a, b]).map((o) => o.id), [e1, a, b].map((o) => o.id));
  // Pas assez d'employeurs différents : complété dans l'ordre.
  assert.deepEqual(pickDistinctEmployers([e1, e2, a]).map((o) => o.id), [e1, a, e2].map((o) => o.id));
  assert.deepEqual(pickDistinctEmployers([e1]), [e1]);
  assert.deepEqual(pickDistinctEmployers([]), []);
});

test("chargement : métier du CV, même recherche que les recommandations, cache 15 min, jamais d'échec", () => {
  const lib = read("lib/guide-offer-picks.ts");
  assert.match(lib, /const job = await latestCvTargetJob\(\);\s*if \(!job\) return \[\];/, "sans métier : pas de liste");
  assert.match(lib, /const basis = await getRecommendationBasis\(\[\], job\);/);
  assert.match(lib, /sort: "pertinence",/);
  assert.match(lib, /\["offres-proposees-accueil"\],\s*\{ revalidate: LATEST_OFFERS_REVALIDATE \},/);
  assert.match(lib, /if \(result\.failed\.includes\("france-travail"\)\) throw new PicksUnavailable\(\);/, "panne : jamais en cache");
  assert.match(lib, /pickDistinctEmployers\(offers, GUIDE_OFFER_PICKS\)/);
  assert.match(lib, /catch \(error\) \{[\s\S]*?return \[\];\s*\}\s*\}\s*$/, "sans échec : liste vide");
});

test("écran : liste en streaming (Suspense, rien en attendant), rien si vide, sous le champ du lien", () => {
  const page = read("app/(onboarding)/bienvenue/page.tsx");
  assert.match(page, /picks=\{\s*<Suspense fallback=\{null\}>\s*<GuideOfferPicks \/>\s*<\/Suspense>\s*\}/);
  assert.match(page, /return picks\.length > 0 \? <GuideOfferPickList picks=\{picks\} \/> : null;/);
  const flow = read("components/onboarding/onboarding-flow.tsx");
  assert.match(flow, /\{GUIDE_TEXTS\.offerNote\}<\/p>\s*\{picks\}/);
  // Le lien et « Trouver une offre » restent là.
  assert.match(flow, /<OfferLinkForm onSubmit=/);
  assert.match(flow, /\{T\.cheminOffre\.search\}/);
});

test("ajout en un clic : accueil=1, boutons désactivés pendant un ajout, accessibles, pleine largeur sur mobile", () => {
  const list = read("components/onboarding/guide-offer-picks.tsx");
  assert.match(list, /<input type="hidden" name="accueil" value="1" \/>/);
  assert.match(list, /<input type="hidden" name="offerId" value=\{pick\.id\} \/>/);
  assert.match(list, /type="submit"\s+disabled=\{pending\}/, "un seul état d'envoi pour toute la liste");
  assert.match(list, /aria-label=\{`\$\{GUIDE_TEXTS\.pickAdd\} « \$\{pick\.title\} »\$\{pick\.company \? ` chez \$\{pick\.company\}` : ""\}`\}/);
  assert.match(list, /className="ui-btn-primary min-h-11 w-full sm:w-auto"/, "44 px, pleine largeur à 390 px");
  assert.match(list, /className="flex flex-col gap-3 rounded-xl[^"]*sm:flex-row/, "cartes empilées sur mobile");
  assert.match(list, /aria-live="polite"/);
  assert.match(list, /if \(picks\.length === 0\) return null;/);
});

test("action d'ajout : la candidature termine la phase guidée (guide_application_id, bandeau), comme le lien", () => {
  const action = read("app/actions/job-offers.ts");
  assert.match(action, /if \(formData\.get\("accueil"\) === "1"\) await completeGuideWithApplication\(id\);\s*revalidatePath\("\/candidatures"\);\s*revalidatePath\("\/dashboard"\);\s*redirect\(`\/candidatures\/\$\{id\}\?creee=1`\);/);
  // Même fonction que le lien : vérifie l'étape guide_offre, enregistre guide_application_id, choix « lien ».
  const server = read("lib/onboarding-server.ts");
  const complete = server.slice(server.indexOf("export async function completeGuideWithApplication"), server.indexOf("export async function shouldShowGuideBanner"));
  assert.match(complete, /row\.step !== "guide_offre"\) return;/);
  assert.match(complete, /update\(\{ guide_application_id: applicationId \}\)/);
  assert.match(complete, /choice: "lien"/);
});

test("textes de Lumeo : titre et sous-titre décidés, tutoiement, sans chiffre ni emoji", () => {
  assert.equal(GUIDE_TEXTS.picksTitle, "Ou choisis parmi ces offres pour toi.");
  assert.equal(GUIDE_TEXTS.picksSubtitle, "Je les ai choisies d'après ton CV.");
  for (const text of [GUIDE_TEXTS.picksTitle, GUIDE_TEXTS.picksSubtitle, GUIDE_TEXTS.pickAdd, GUIDE_TEXTS.pickAdding]) {
    assert.doesNotMatch(text, /\d|\p{Extended_Pictographic}|\bvous\b|illimit|premium/iu);
  }
});
