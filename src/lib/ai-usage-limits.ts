// Limites mensuelles d'utilisation de l'IA (plan gratuit), partagées entre les pages
// (serveur) et les composants (client). Elles sont aussi appliquées par la base
// (record_ai_usage, migrations 0013, 0014, 0020 et 0023) : garder les deux définitions alignées.
// Les utilisateurs Premium n'ont pas de limite mensuelle, seulement la limite quotidienne.

/** Types d'action IA. */
export const AI_USAGE_KINDS = [
  "resume_offre",
  "resume_recherche",
  "adaptation_cv",
  "cv_ameliore",
  "affinage_cv",
  "lettre",
  "affinage_lettre",
] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** Plan gratuit : nombre d'actions par type et par mois (regénérations comprises) : un essai. */
export const AI_MONTHLY_LIMITS: Record<AiUsageKind, number> = {
  resume_offre: 1,
  resume_recherche: 1,
  adaptation_cv: 1,
  cv_ameliore: 1,
  affinage_cv: 1,
  lettre: 1,
  affinage_lettre: 1,
};

export const AI_USAGE_LABELS: Record<AiUsageKind, { title: string; unit: string; feminine: boolean }> = {
  resume_offre: { title: "Résumés d'offre", unit: "résumés", feminine: false },
  resume_recherche: { title: "Résumés d'offre — Trouver une offre", unit: "résumés", feminine: false },
  adaptation_cv: { title: "Analyses de CV", unit: "analyses", feminine: true },
  cv_ameliore: { title: "CV ouverts dans l'éditeur", unit: "ouvertures", feminine: true },
  affinage_cv: { title: "Chat « Affiner avec l'IA » — CV", unit: "messages", feminine: false },
  lettre: { title: "Lettres de motivation", unit: "générations", feminine: true },
  affinage_lettre: { title: "Chat « Affiner avec l'IA » — lettre", unit: "messages", feminine: false },
};

/** Utilisation d'un type d'action pour le mois en cours ; `limit` null : illimité (Premium). */
export type AiUsageCount = { used: number; limit: number | null };

export type AiUsage = {
  premium: boolean;
  counts: Record<AiUsageKind, AiUsageCount>;
  /** Actions IA du jour, tous types confondus (depuis minuit, heure de Paris). */
  usedToday: number;
  /** Date de remise à zéro (YYYY-MM-DD) : le 1er du mois prochain. */
  resetsOn: string;
};

/** Prix du Premium, en euros TTC : sans engagement (mensuel) ou par 3 mois (renouvelable). */
export const PREMIUM_PRICE_MONTHLY = 12;
export const PREMIUM_PRICE_QUARTERLY = 24;
export const PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY = PREMIUM_PRICE_QUARTERLY / 3;

/** Prix d'appel du Premium : l'offre 3 mois, ramenée au mois. */
export const PREMIUM_PRICE_FROM_LABEL = `à partir de ${PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY} €/mois`;

export const LIMIT_REACHED_LABEL = "Essai gratuit utilisé";

/** Message commun à toutes les actions IA quand l'essai gratuit du mois est utilisé. */
export const LIMIT_REACHED_MESSAGE = `Tu as utilisé ton essai gratuit. Passe au Premium ${PREMIUM_PRICE_FROM_LABEL} pour un accès illimité.`;

/**
 * Anti-abus, tous plans : actions IA par jour (tous types confondus, remise à zéro à minuit,
 * heure de Paris) et requêtes à Claude par minute (migration 0020).
 */
export const AI_DAILY_LIMIT = 50;
export const AI_RATE_LIMIT_PER_MINUTE = 10;

export const DAILY_LIMIT_MESSAGE =
  "Tu as atteint ta limite quotidienne d'actions IA. Elle se remet à zéro à minuit.";

export const RATE_LIMIT_MESSAGE = "Trop de requêtes, attends quelques secondes.";

export function isLimitReached({ used, limit }: AiUsageCount) {
  return limit !== null && used >= limit;
}

/** Ex. « 2/3 messages utilisés », ou « 5 messages utilisés » en illimité. */
export function usageLabel(kind: AiUsageKind, { used, limit }: AiUsageCount) {
  const { unit, feminine } = AI_USAGE_LABELS[kind];
  const count = limit === null ? `${used}` : `${Math.min(used, limit)}/${limit}`;
  return `${count} ${unit} ${feminine ? "utilisées" : "utilisés"}`;
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « 1er novembre 2026 » à partir de « 2026-11-01 ». */
export function formatResetDate(resetsOn: string) {
  return `1er ${monthFormatter.format(new Date(`${resetsOn}T00:00:00Z`))}`;
}
