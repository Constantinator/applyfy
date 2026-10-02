// Limites mensuelles d'utilisation de l'IA, partagées entre les pages (serveur) et les
// composants (client). La limite est aussi appliquée par la base (record_ai_usage,
// migration 0011) : garder les deux valeurs alignées.

export const AI_USAGE_KINDS = ["resume_offre", "adaptation_cv", "lettre"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** Plan gratuit : nombre d'actions par type et par mois. */
export const FREE_MONTHLY_LIMIT = 3;

export const AI_USAGE_LABELS: Record<AiUsageKind, { title: string; plural: string; feminine: boolean }> = {
  resume_offre: { title: "Résumés d'offre", plural: "résumés", feminine: false },
  adaptation_cv: { title: "Adaptations de CV", plural: "adaptations", feminine: true },
  lettre: { title: "Lettres de motivation", plural: "lettres", feminine: true },
};

/** Utilisation d'un type d'action pour le mois en cours. */
export type AiUsageCount = { used: number; limit: number };

export type AiUsage = {
  counts: Record<AiUsageKind, AiUsageCount>;
  /** Date de remise à zéro (YYYY-MM-DD) : le 1er du mois prochain. */
  resetsOn: string;
};

export const LIMIT_REACHED_LABEL = "Limite mensuelle atteinte";

export function isLimitReached({ used, limit }: AiUsageCount) {
  return used >= limit;
}

/** Ex. « Tu as utilisé tes 3 lettres gratuites ce mois-ci. » */
export function limitReachedMessage(kind: AiUsageKind, limit = FREE_MONTHLY_LIMIT) {
  const { plural, feminine } = AI_USAGE_LABELS[kind];
  return `Tu as utilisé tes ${limit} ${plural} ${feminine ? "gratuites" : "gratuits"} ce mois-ci.`;
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « 1er novembre 2026 » à partir de « 2026-11-01 ». */
export function formatResetDate(resetsOn: string) {
  return `1er ${monthFormatter.format(new Date(`${resetsOn}T00:00:00Z`))}`;
}
