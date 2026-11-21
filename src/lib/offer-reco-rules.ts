// Recommandations de « Trouver une offre » : règles pures, testables (lib/offer-recommendations,
// page /offres).
import type { OfferSource } from "./offer-types";

const DAY = 86_400_000;

/**
 * Un lieu (candidature ou recherche) n'est retenu pour les recommandations que s'il a au plus
 * 30 jours : un ancien lieu (donnée de test, déménagement) ne colle pas au compte. Les sources
 * plus anciennes comptent toujours pour le métier.
 */
export const LOCATION_MAX_AGE_DAYS = 30;

export function isLocationRecent(ageMs: number): boolean {
  return Number.isFinite(ageMs) && ageMs <= LOCATION_MAX_AGE_DAYS * DAY;
}

/**
 * Recommandations sans aucune offre : on affiche les dernières offres publiées à la place, jamais
 * une page vide. Pas de bascule si France Travail a échoué (une seconde recherche risquerait la
 * même attente) ; une panne d'Adzuna seule ne l'empêche pas.
 */
export function shouldFallBackToLatest(result: { total: number; failed: OfferSource[] } | null): boolean {
  return result !== null && result.total === 0 && !result.failed.includes("france-travail");
}
