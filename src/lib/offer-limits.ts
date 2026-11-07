// Limites partagées entre le formulaire (client) et les Server Actions.

/** Longueur minimale d'une description pour qu'un résumé ait du sens. */
export const SUMMARY_MIN_LENGTH = 200;

export const OFFER_DESCRIPTION_MAX_LENGTH = 20000;
export const OFFER_SUMMARY_MAX_LENGTH = 4000;
/** Texte d'offre collé à la main quand le lien n'a pas pu être lu. */
export const OFFER_PASTED_TEXT_MAX_LENGTH = 40000;
export const OFFER_URL_MAX_LENGTH = 2000;

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Lien d'offre reçu dans l'adresse (?lien=) : le lien nettoyé, ou null s'il est invalide. */
export function parseOfferLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return url.length <= OFFER_URL_MAX_LENGTH && isHttpUrl(url) ? url : null;
}
