import "server-only";

import { getApplications } from "./applications";
import { resolveDepartment } from "./geo";
import { titleKeywords } from "./offer-title";
import type { ContractFilter } from "./offer-types";
import type { RecentSearch } from "./recent-searches";

// Recommandations personnalisées de la page « Trouver une offre » : une recherche
// construite à partir des candidatures et des recherches récentes de l'utilisateur
// (métier et localisation qui pèsent le plus, stage ou alternance si c'est ce qui domine).
// Chaque source pèse selon son ancienneté : une recherche qui vient d'être faite compte
// davantage que des candidatures anciennes.

export type RecommendationBasis = {
  /** Mots-clés de la recherche (3 au plus), tirés de l'intitulé de poste le plus fréquent. */
  keywords: string;
  /** Localisation retenue (reconnue par la recherche), ou "" si aucune. */
  place: string;
  /** Stage ou alternance, si la majorité des candidatures en sont. */
  contract: ContractFilter | null;
  /** Nombre de candidatures analysées. */
  applicationCount: number;
  /** Nombre de recherches récentes analysées. */
  searchCount: number;
};

/** Localisation exploitable : code de département ou nom de ville. */
function cleanLocation(location: string) {
  const text = location.trim();
  // « 69 - Lyon 3e » (format France Travail), « Paris (75) »
  const code = text.match(/^(\d{2,3}|2[ab])\s*-/i)?.[1] ?? text.match(/\((\d{2,3}|2[ab])\)/i)?.[1];
  if (code) return code;
  return text
    .split(/[,(–—]/)[0]
    .replace(/\s+\d+(e|er|ème)?$/i, "") // « Lyon 3e » → « Lyon »
    .trim();
}

const DAY = 86_400_000;

/** Poids d'une candidature (envoyée) selon son ancienneté. */
function applicationWeight(ageMs: number) {
  if (ageMs <= 14 * DAY) return 1;
  if (ageMs <= 60 * DAY) return 0.5;
  return 0.25;
}

/**
 * Poids d'une recherche selon son ancienneté : celle qui vient d'être faite (moins d'un
 * jour) l'emporte sur trois candidatures récentes, et largement sur des candidatures anciennes.
 */
function searchWeight(ageMs: number) {
  if (ageMs <= DAY) return 3;
  if (ageMs <= 7 * DAY) return 1.5;
  return 0.75;
}

/** Stage ou alternance d'après un intitulé ou des mots-clés. */
function contractIn(text: string): ContractFilter | null {
  if (/stag(e|iaire)/i.test(text)) return "stage";
  if (/alternan(ce|t)|apprenti/i.test(text)) return "alternance";
  return null;
}

type Vote<T> = { value: T; weight: number };

/** Valeurs classées par poids cumulé ; à égalité, la première rencontrée (la plus récente) d'abord. */
function byWeight(votes: Vote<string>[]): string[] {
  const totals = new Map<string, { value: string; weight: number; firstIndex: number }>();
  votes.forEach(({ value, weight }, index) => {
    const key = value.toLowerCase();
    const entry = totals.get(key);
    if (entry) entry.weight += weight;
    else totals.set(key, { value, weight, firstIndex: index });
  });
  return [...totals.values()]
    .sort((a, b) => b.weight - a.weight || a.firstIndex - b.firstIndex)
    .map((entry) => entry.value);
}

/**
 * Base de la recherche recommandée ; null si l'utilisateur n'a ni candidature exploitable
 * ni recherche récente. Les brouillons sont ignorés : seules comptent les candidatures envoyées.
 */
export async function getRecommendationBasis(searches: RecentSearch[] = []): Promise<RecommendationBasis | null> {
  const { applications: all } = await getApplications(); // de la plus récente à la plus ancienne
  const applications = all.filter((app) => app.status !== "brouillon");
  const now = Date.now();

  // Recherches d'abord (les plus récentes), puis candidatures : à poids égal, elles passent devant.
  const sources = [
    ...searches.map((search) => ({
      title: search.keywords,
      location: search.place,
      contract: search.contract ?? contractIn(search.keywords),
      weight: searchWeight(now - search.at),
    })),
    ...applications.map((app) => ({
      title: app.position,
      location: app.location ?? "",
      contract: contractIn(app.position),
      weight: applicationWeight(now - Date.parse(app.applied_at ?? app.created_at)),
    })),
  ];

  // Poids des mots-clés (et non des intitulés) : « Marketing Manager » et « Responsable
  // marketing » comptent tous deux pour « marketing ».
  const titles = byWeight(
    sources
      .map((source) => ({ value: titleKeywords(source.title), weight: source.weight }))
      .filter((vote) => vote.value.length >= 2),
  );
  if (titles.length === 0) return null;

  // Première localisation reconnue parmi celles qui pèsent le plus (3 essais au plus) ;
  // sinon, toute la France.
  const locations = byWeight(
    sources
      .map((source) => ({ value: source.location ? cleanLocation(source.location) : "", weight: source.weight }))
      .filter((vote) => vote.value.length >= 2),
  );
  let place = "";
  for (const candidate of locations.slice(0, 3)) {
    if (await resolveDepartment(candidate)) {
      place = candidate.slice(0, 80);
      break;
    }
  }

  // Stage ou alternance si c'est la majorité (en poids) des candidatures et recherches.
  const totalWeight = sources.reduce((sum, source) => sum + source.weight, 0);
  const share = (contract: ContractFilter) =>
    sources.filter((source) => source.contract === contract).reduce((sum, source) => sum + source.weight, 0) /
    totalWeight;
  const contract: ContractFilter | null = share("stage") > 0.5 ? "stage" : share("alternance") > 0.5 ? "alternance" : null;

  return {
    keywords: titles[0].slice(0, 120),
    place,
    contract,
    applicationCount: applications.length,
    searchCount: searches.length,
  };
}
