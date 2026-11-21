// Mélange des résultats des sources de « Trouver une offre » (lib/offers) : règle pure, testable.
import { SOURCE_PAGE_SIZE, type OfferListing, type OfferSource } from "./offer-types";

/**
 * Même intitulé chez le même employeur dans deux sources différentes : Adzuna reprend parfois des
 * offres France Travail. Dans une même source, ce sont des annonces distinctes (un cabinet publie
 * le même intitulé dans plusieurs régions) : elles restent toutes.
 */
const duplicateKey = (offer: OfferListing) =>
  `${offer.title}|${offer.company ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9|]/g, "");

/**
 * Une offre de chaque source à tour de rôle, sans doublons entre sources : une page affiche toutes
 * les offres reçues de chaque source (le tri est fait ensuite).
 */
export function mergeSourceOffers(pages: { offers: OfferListing[] }[]): OfferListing[] {
  const firstSource = new Map<string, OfferSource>();
  const offers: OfferListing[] = [];
  for (let i = 0; i < SOURCE_PAGE_SIZE; i++) {
    for (const page of pages) {
      const offer = page.offers[i];
      if (!offer) continue;
      const key = duplicateKey(offer);
      const owner = firstSource.get(key);
      if (owner !== undefined && owner !== offer.source) continue;
      if (owner === undefined) firstSource.set(key, offer.source);
      offers.push(offer);
    }
  }
  return offers;
}
