import "server-only";

import { unstable_cache } from "next/cache";

import { latestCvTargetJob } from "./latest-cv-job";
import { pickDistinctEmployers } from "./offer-merge";
import { getRecommendationBasis } from "./offer-recommendations";
import type { OfferSearch } from "./offer-types";
import {
  LATEST_OFFERS_REVALIDATE,
  isOfferSearchConfigured,
  offerQueryParams,
  resolveOfferSearch,
  searchAllOffers,
  type OfferQuery,
} from "./offers";

/** Offre proposée sur l'écran de l'offre : de quoi l'afficher et l'ajouter (action d'ajout). */
export type GuideOfferPick = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  /** Paramètres de la recherche où l'offre a été trouvée (pour la retrouver à l'ajout). */
  search: string;
};

export const GUIDE_OFFER_PICKS = 3;

/** France Travail en échec : rien n'est gardé en cache (la liste disparaît, nouvel essai ensuite). */
class PicksUnavailable extends Error {}

/**
 * Même recherche que les recommandations de /offres, en cache 15 minutes (clé : la recherche,
 * donc partagée par les comptes au même métier). Une panne de France Travail n'est pas mise en
 * cache ; une panne d'Adzuna seule, oui (les autres sources suffisent).
 */
const recommendedOffers = unstable_cache(
  async (search: OfferSearch) => {
    const result = await searchAllOffers(search);
    if (result.failed.includes("france-travail")) throw new PicksUnavailable();
    return result.offers;
  },
  ["offres-proposees-accueil"],
  { revalidate: LATEST_OFFERS_REVALIDATE },
);

/**
 * 3 offres pour l'écran de l'offre de la phase guidée, d'après le métier du dernier CV,
 * d'employeurs différents si possible. Sans métier, source en panne ou 0 offre : liste vide
 * (l'écran ne montre rien de plus). Sans échec.
 */
export async function loadGuideOfferPicks(): Promise<GuideOfferPick[]> {
  try {
    if (!isOfferSearchConfigured()) return [];
    const job = await latestCvTargetJob();
    if (!job) return [];
    const basis = await getRecommendationBasis([], job);
    if (!basis) return [];
    const query: OfferQuery = {
      keywords: basis.keywords,
      place: basis.place,
      contract: basis.contract,
      sort: "pertinence",
      sortChosen: false,
      page: 1,
    };
    const { search } = await resolveOfferSearch(query);
    if (!search) return [];
    const offers = await recommendedOffers(search);
    const params = offerQueryParams(query).toString();
    return pickDistinctEmployers(offers, GUIDE_OFFER_PICKS).map((offer) => ({
      id: offer.id,
      title: offer.title,
      company: offer.company,
      location: offer.location,
      search: params,
    }));
  } catch (error) {
    if (!(error instanceof PicksUnavailable)) console.error("[onboarding] offres proposées", error);
    return [];
  }
}
