// Chargement et validation des fixtures : profils (CvDataSchema), offres (forme d'une candidature
// lue en base, mots-clés au format CvSuggestions), scénarios, personas, mots-clés du marché figés.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { CvDataSchema, type CvData } from "../../src/lib/cv-builder-types.ts";
import { readCvSuggestions } from "../../src/lib/cv-types.ts";
import { isSector, type Sector } from "../../src/lib/sectors.ts";

const root = new URL("./fixtures/", import.meta.url);

export type FixtureSet = "dev" | "holdout";
export type Language = "fr" | "en";

export type Profile = { id: string; set: FixtureSet; sector: Sector; level: string; language: Language; facts: string[]; cv: CvData };

/** Candidature synthétique liée au CV, telle que la lit l'action (getApplicationDetail). */
export type OfferDetail = {
  application: {
    id: string;
    position: string;
    company: string;
    sector: string;
    offer_description: string;
    offer_summary: null;
    cv_suggestions: unknown;
  };
};
export type Offer = { id: string; set: FixtureSet; detail: OfferDetail; keywords: string[] };

export type RequestExpect =
  | { kind: "translate"; to: Language }
  | { kind: "shorten"; section: "summary" }
  | { kind: "addBullet"; experienceId: string; mustContain: string }
  | { kind: "groupSkills" };

export type Scenario = {
  id: string;
  set: FixtureSet;
  case: "libre" | "lie";
  type: string;
  profile: string;
  offer?: string;
  persona: string;
  expectedSector: Sector;
  behavior: string;
  firstMessage?: string;
  injection?: { canary: string; where: "message" | "cv" | "offer" };
  injectionText?: string;
  cvPatch?: { experienceId: string; bullet: string };
  expect?: { request?: RequestExpect; honestGap?: boolean; titleProposalOnce?: boolean; closed?: boolean };
  dryMessages: string[];
};

export type Fixtures = {
  profiles: Map<string, Profile>;
  offers: Map<string, Offer>;
  scenarios: Scenario[];
  personas: Record<string, string>;
  marketKeywords: Record<Sector, string[]>;
  /** Empreinte des fixtures : deux runs ne sont comparés que sur les mêmes scénarios. */
  hash: string;
};

function fail(message: string): never {
  throw new Error(`Fixtures invalides : ${message}`);
}

export function loadFixtures(): Fixtures {
  const raw: string[] = [];
  const profiles = new Map<string, Profile>();
  for (const set of ["dev", "holdout"] as const) {
    for (const file of readdirSync(new URL(`profiles/${set}/`, root)).filter((f) => f.endsWith(".json")).sort()) {
      const text = readFileSync(new URL(`profiles/${set}/${file}`, root), "utf8");
      raw.push(text);
      const p = JSON.parse(text);
      const parsed = CvDataSchema.safeParse(p.cv);
      if (!parsed.success) fail(`profil ${file} : ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
      if (!isSector(p.sector)) fail(`profil ${file} : secteur ${p.sector}`);
      if (p.language !== "fr" && p.language !== "en") fail(`profil ${file} : langue ${p.language}`);
      if (profiles.has(p.id)) fail(`profil ${p.id} en double`);
      profiles.set(p.id, { id: p.id, set, sector: p.sector, level: p.level, language: p.language, facts: p.facts ?? [], cv: parsed.data });
    }
  }

  const offersText = readFileSync(new URL("offers.json", root), "utf8");
  raw.push(offersText);
  const offers = new Map<string, Offer>();
  for (const o of JSON.parse(offersText).offers) {
    if (!isSector(o.sector)) fail(`offre ${o.id} : secteur ${o.sector}`);
    const keywords: string[] = o.keywords ?? [];
    // Mots-clés de l'offre au format enregistré par « Adapter mon CV » (les premiers pèsent le plus).
    const cv_suggestions = {
      keywords: keywords.map((keyword, i) => ({ keyword, group: "technique", variants: [], weight: keywords.length - i })),
      ignored: [],
      conseils: [],
      titre_cv: "",
      cvText: null,
    };
    if (readCvSuggestions(cv_suggestions)?.kind !== "keywords") fail(`offre ${o.id} : mots-clés illisibles`);
    offers.set(o.id, {
      id: o.id,
      set: o.set,
      keywords,
      detail: {
        application: {
          id: `eval-${o.id}`,
          position: o.position,
          company: o.company,
          sector: o.sector,
          offer_description: o.offer_description,
          offer_summary: null,
          cv_suggestions,
        },
      },
    });
  }

  const scenariosText = readFileSync(new URL("scenarios.json", root), "utf8");
  const personasText = readFileSync(new URL("personas.json", root), "utf8");
  const marketText = readFileSync(new URL("market-keywords.json", root), "utf8");
  raw.push(scenariosText, personasText, marketText);
  const personas = JSON.parse(personasText) as Record<string, string>;
  const market = JSON.parse(marketText);
  const marketKeywords = {} as Record<Sector, string[]>;
  for (const [sector, list] of Object.entries(market)) if (isSector(sector)) marketKeywords[sector] = list as string[];

  const scenarios: Scenario[] = JSON.parse(scenariosText).scenarios;
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) fail(`scénario ${s.id} en double`);
    ids.add(s.id);
    const profile = profiles.get(s.profile) ?? fail(`scénario ${s.id} : profil ${s.profile} inconnu`);
    if (profile.set !== s.set) fail(`scénario ${s.id} : profil d'un autre jeu (${profile.set})`);
    if (!personas[s.persona]) fail(`scénario ${s.id} : persona ${s.persona} inconnue`);
    if (!isSector(s.expectedSector)) fail(`scénario ${s.id} : secteur attendu ${s.expectedSector}`);
    if (s.case === "lie") {
      const offer = (s.offer && offers.get(s.offer)) || fail(`scénario ${s.id} : offre manquante`);
      if (offer.set !== s.set) fail(`scénario ${s.id} : offre d'un autre jeu`);
    } else if (s.offer) fail(`scénario ${s.id} : offre sur un CV libre`);
    if (s.cvPatch && !profile.cv.experiences.some((e) => e.id === s.cvPatch!.experienceId)) fail(`scénario ${s.id} : expérience ${s.cvPatch.experienceId}`);
    if (!Array.isArray(s.dryMessages) || !s.dryMessages.length) fail(`scénario ${s.id} : dryMessages vide`);
  }

  const hash = createHash("sha256").update(raw.join("\n")).digest("hex").slice(0, 12);
  return { profiles, offers, scenarios, personas, marketKeywords, hash };
}
