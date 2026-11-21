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
 * Variété d'une page de recommandations ou de dernières offres : au plus `max` cartes par employeur
 * et intitulé dans l'ordre de la page, le surplus repoussé en fin de page (dans son ordre). Aucune
 * offre perdue : compteur et pagination inchangés.
 */
export const MAX_SAME_OFFER_PER_PAGE = 2;

export function spreadRepeats<T extends OfferListing>(offers: T[], max = MAX_SAME_OFFER_PER_PAGE): T[] {
  const counts = new Map<string, number>();
  const kept: T[] = [];
  const pushed: T[] = [];
  for (const offer of offers) {
    const key = duplicateKey(offer);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    (count <= max ? kept : pushed).push(offer);
  }
  return [...kept, ...pushed];
}

/**
 * Offres proposées sur l'écran de l'offre de la phase guidée : `count` offres dans l'ordre donné,
 * d'employeurs différents si possible (complétées ensuite par les suivantes).
 */
export function pickDistinctEmployers<T extends OfferListing>(offers: T[], count = 3): T[] {
  const employer = (offer: T) => (offer.company ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const seen = new Set<string>();
  const picks: T[] = [];
  for (const offer of offers) {
    if (picks.length === count) return picks;
    if (seen.has(employer(offer))) continue;
    seen.add(employer(offer));
    picks.push(offer);
  }
  for (const offer of offers) {
    if (picks.length === count) break;
    if (!picks.includes(offer)) picks.push(offer);
  }
  return picks;
}

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
