// Consentement aux traceurs publicitaires (Meta Pixel), mémorisé dans le navigateur.
// Recommandation CNIL : choix redemandé au bout de 6 mois, refus aussi simple que
// l'acceptation, et modifiable à tout moment (lien « Gestion des cookies » du pied de page).

export type Consent = "granted" | "denied";

const STORAGE_KEY = "applyfy-consent";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 182; // ~6 mois

/** Événement qui rouvre le bandeau (lien du pied de page). */
export const OPEN_CONSENT_EVENT = "applyfy:open-consent";

/** Choix enregistré et encore valable, sinon null (jamais demandé, expiré ou illisible). */
export function readConsent(): Consent | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as {
      value?: unknown;
      at?: unknown;
    } | null;
    if (!saved || (saved.value !== "granted" && saved.value !== "denied")) return null;
    if (typeof saved.at !== "number" || Date.now() - saved.at > MAX_AGE_MS) return null;
    return saved.value;
  } catch {
    return null;
  }
}

export function saveConsent(value: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: Date.now() }));
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour cette visite seulement.
  }
}
