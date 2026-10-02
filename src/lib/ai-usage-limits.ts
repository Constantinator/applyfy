// Limites mensuelles d'utilisation de l'IA (plan gratuit), partagées entre les pages
// (serveur) et les composants (client). Elles sont aussi appliquées par la base
// (record_ai_usage, migration 0013) : garder les deux définitions alignées.

/** Types d'action IA, dans l'ordre d'affichage de « Mon utilisation ». */
export const AI_USAGE_KINDS = [
  "resume_offre",
  "adaptation_cv",
  "cv_ameliore",
  "affinage_cv",
  "lettre",
  "affinage_lettre",
] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** Plan gratuit : nombre d'actions par type et par mois (regénérations comprises). */
export const AI_MONTHLY_LIMITS: Record<AiUsageKind, number> = {
  resume_offre: 2,
  adaptation_cv: 2,
  cv_ameliore: 2,
  affinage_cv: 2,
  lettre: 2,
  affinage_lettre: 2,
};

export const AI_USAGE_LABELS: Record<AiUsageKind, { title: string; unit: string; feminine: boolean }> = {
  resume_offre: { title: "Résumés d'offre", unit: "résumés", feminine: false },
  adaptation_cv: { title: "Analyses de CV", unit: "analyses", feminine: true },
  cv_ameliore: { title: "CV améliorés", unit: "générations", feminine: true },
  affinage_cv: { title: "Chat « Affiner avec l'IA » — CV", unit: "messages", feminine: false },
  lettre: { title: "Lettres de motivation", unit: "générations", feminine: true },
  affinage_lettre: { title: "Chat « Affiner avec l'IA » — lettre", unit: "messages", feminine: false },
};

/** Utilisation d'un type d'action pour le mois en cours. */
export type AiUsageCount = { used: number; limit: number };

export type AiUsage = {
  counts: Record<AiUsageKind, AiUsageCount>;
  /** Date de remise à zéro (YYYY-MM-DD) : le 1er du mois prochain. */
  resetsOn: string;
};

export const PREMIUM_PRICE_LABEL = "8 €/mois";

export const LIMIT_REACHED_LABEL = "Limite mensuelle atteinte";

/** Message commun à toutes les actions IA quand la limite du mois est atteinte. */
export const LIMIT_REACHED_MESSAGE = `Tu as atteint ta limite mensuelle gratuite. Passe au Premium à ${PREMIUM_PRICE_LABEL} pour un accès illimité.`;

export function isLimitReached({ used, limit }: AiUsageCount) {
  return used >= limit;
}

/** Ex. « 2/3 messages utilisés ». */
export function usageLabel(kind: AiUsageKind, { used, limit }: AiUsageCount) {
  const { unit, feminine } = AI_USAGE_LABELS[kind];
  return `${Math.min(used, limit)}/${limit} ${unit} ${feminine ? "utilisées" : "utilisés"}`;
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « 1er novembre 2026 » à partir de « 2026-11-01 ». */
export function formatResetDate(resetsOn: string) {
  return `1er ${monthFormatter.format(new Date(`${resetsOn}T00:00:00Z`))}`;
}
