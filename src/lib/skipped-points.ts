// Points abandonnés de la session du coach (cv_coach_history.skipped_points, migration 0033) :
// textes libres écrits par le coach, et étapes de l'offre faites (CV lié), identifiées par un
// objet { step } que seul le serveur crée (le modèle n'écrit que des textes). Utilisable dans le
// navigateur : l'éditeur lit, fusionne et renvoie la liste sans l'interpréter.

/** Étapes d'adaptation à l'offre d'un CV lié (coach-offer.ts). */
export const OFFER_STEPS = ["titre", "resume", "ecart"] as const;
export type OfferStep = (typeof OFFER_STEPS)[number];

/** Étape de l'offre faite, par identifiant. */
export type OfferStepEntry = { step: OfferStep };
/** Point abandonné : texte libre, ou étape de l'offre faite. */
export type SkippedEntry = string | OfferStepEntry;

const isStep = (value: unknown): value is OfferStep => typeof value === "string" && (OFFER_STEPS as readonly string[]).includes(value);

/** Ancien marqueur texte d'une étape (« offre:titre »), écrit par le serveur avant les identifiants. */
const LEGACY_PREFIX = "offre:";
export const isLegacyStepMarker = (point: string) => point.trim().toLowerCase().startsWith(LEGACY_PREFIX);

/**
 * Étape désignée par une entrée : objet { step } ; ancien marqueur « offre:x » d'une conversation
 * enregistrée avant les identifiants (relu, jamais écrit) ; null pour un texte libre.
 */
export function stepOf(entry: unknown): OfferStep | null {
  if (entry && typeof entry === "object" && isStep((entry as { step?: unknown }).step)) return (entry as OfferStepEntry).step;
  if (typeof entry === "string" && isLegacyStepMarker(entry)) {
    const step = entry.trim().slice(LEGACY_PREFIX.length);
    return isStep(step) ? step : null;
  }
  return null;
}

/** Entrée d'une étape (objet), créée par le serveur. */
export const stepEntry = (step: OfferStep): OfferStepEntry => ({ step });

/** Clé de comparaison (doublons) : « step:titre » pour une étape, le texte sinon. */
const keyOf = (entry: SkippedEntry) => {
  const step = stepOf(entry);
  return step ? `step:${step}` : `text:${entry as string}`;
};

/**
 * Liste lue en base ou renvoyée par l'éditeur : textes non vides et étapes (anciens marqueurs
 * relus comme étapes) ; tout le reste est ignoré.
 */
export function readSkipped(value: unknown): SkippedEntry[] {
  if (!Array.isArray(value)) return [];
  const out: SkippedEntry[] = [];
  for (const item of value) {
    const step = stepOf(item);
    if (step) out.push(stepEntry(step));
    else if (typeof item === "string" && item.trim()) out.push(item);
  }
  return mergeSkipped(out, []);
}

/** Deux listes réunies, sans doublon (une étape une fois, un texte une fois), dans l'ordre. */
export function mergeSkipped(a: SkippedEntry[], b: SkippedEntry[]): SkippedEntry[] {
  const seen = new Set<string>();
  return [...a, ...b].filter((entry) => {
    const key = keyOf(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
