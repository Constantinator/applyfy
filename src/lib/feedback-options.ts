// Questions du formulaire « Donner mon avis », partagées entre le formulaire (client), la
// sauvegarde (serveur) et le tableau de bord admin. Valeurs alignées avec les contraintes
// de la table "feedback" (migration 0016).

export const FAVORITE_FEATURES = {
  suivi: "Suivi des candidatures",
  adaptation_cv: "Adaptation du CV",
  lettre: "Lettre de motivation",
  recherche_offres: "Recherche d'offres",
  relances: "Rappels de relance",
} as const;
export type FavoriteFeature = keyof typeof FAVORITE_FEATURES;

export const MISSING_FEATURES = {
  plus_offres: "Plus d'offres",
  adaptation_cv: "Meilleure adaptation CV",
  mobile: "Application mobile",
  linkedin: "Intégration LinkedIn",
  autre: "Autre",
} as const;
export type MissingFeature = keyof typeof MISSING_FEATURES;

export const RECOMMEND_ANSWERS = {
  oui: "Oui",
  peut_etre: "Peut-être",
  non: "Non",
} as const;
export type RecommendAnswer = keyof typeof RECOMMEND_ANSWERS;

export const IMPROVEMENT_MAX_LENGTH = 2000;

export type Feedback = {
  rating: number;
  favoriteFeature: FavoriteFeature;
  missing: MissingFeature[];
  improvement: string | null;
  recommend: RecommendAnswer;
};

const isKey = <T extends object>(options: T, value: unknown): value is keyof T =>
  typeof value === "string" && Object.hasOwn(options, value);

/** Avis valide (reçu du navigateur), ou message d'erreur. */
export function parseFeedback(input: unknown): Feedback | string {
  const data = (input ?? {}) as Record<string, unknown>;
  const rating = Number(data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Donne une note de 1 à 5 étoiles.";
  if (!isKey(FAVORITE_FEATURES, data.favoriteFeature)) return "Choisis ta fonctionnalité préférée.";
  if (!isKey(RECOMMEND_ANSWERS, data.recommend)) return "Dis-nous si tu recommanderais Applyfy.";
  const missing = Array.isArray(data.missing) ? data.missing : [];
  if (!missing.every((item) => isKey(MISSING_FEATURES, item))) return "Réponse invalide.";
  const improvement = typeof data.improvement === "string" ? data.improvement.trim() : "";
  if (improvement.length > IMPROVEMENT_MAX_LENGTH) return "Ta suggestion est trop longue (2 000 caractères max).";

  return {
    rating,
    favoriteFeature: data.favoriteFeature,
    missing: [...new Set(missing as MissingFeature[])],
    improvement: improvement || null,
    recommend: data.recommend,
  };
}
