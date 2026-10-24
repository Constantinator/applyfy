import { isContractFilter, type ContractFilter } from "./offer-types";

// Recherches récentes de la page « Trouver une offre », pour les recommandations
// personnalisées. Gardées dans un cookie du navigateur (écrit côté client, lu par le
// serveur qui calcule les recommandations) : rien n'est enregistré en base.

export const RECENT_SEARCHES_COOKIE = "applyfy_recherches";
/** Recherches gardées, les plus récentes d'abord. */
const MAX_RECENT_SEARCHES = 5;
/** Au-delà, une recherche est oubliée. */
export const RECENT_SEARCH_MAX_AGE_DAYS = 30;

export type RecentSearch = {
  keywords: string;
  place: string;
  contract: ContractFilter | null;
  /** Date de la recherche (ms). */
  at: number;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Liste lue dans le cookie, validée ; vide si absente ou illisible. */
export function parseRecentSearches(raw: string | undefined, now = Date.now()): RecentSearch[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const oldest = now - RECENT_SEARCH_MAX_AGE_DAYS * 86_400_000;
  return data
    .map((item: Record<string, unknown>) => ({
      keywords: text(item?.keywords, 120),
      place: text(item?.place, 80),
      contract: isContractFilter(item?.contract) ? item.contract : null,
      at: typeof item?.at === "number" ? item.at : 0,
    }))
    .filter((search) => (search.keywords || search.place) && search.at > oldest && search.at <= now + 60_000)
    .slice(0, MAX_RECENT_SEARCHES);
}

/** Ajoute une recherche en tête (une recherche identique plus ancienne est retirée). */
export function addRecentSearch(list: RecentSearch[], search: RecentSearch): RecentSearch[] {
  const key = (s: RecentSearch) => `${s.keywords}|${s.place}|${s.contract ?? ""}`.toLowerCase();
  return [search, ...list.filter((s) => key(s) !== key(search))].slice(0, MAX_RECENT_SEARCHES);
}
