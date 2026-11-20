// Temps gagné par candidature (bêta) : validation, gain, statistiques et signalements (fonctions
// pures, testables). Règles alignées avec la migration 0044 (bornes et conditions de réponse).
// Gain d'une personne = 1 - après / avant ; aucune réponse n'est jamais exclue des statistiques.

import type { BetaStatus } from "./beta-rules";

/** Bornes des deux réponses, en minutes entières (mêmes valeurs que la base). */
export const TIME_SAVING_MIN_MINUTES = 1;
export const TIME_SAVING_MAX_MINUTES = 600;
/** Nombre de réponses à partir duquel un chiffre public pourra être affiché. */
export const TIME_SAVING_PUBLIC_MIN_RESPONSES = 10;

export type TimeSavingAnswer = { before: number; after: number };

const ERRORS = {
  integer: "Indique un nombre entier de minutes.",
  beforeZero: "Le temps avant Applyfy doit être d'au moins 1 minute.",
  tooHigh: `${TIME_SAVING_MAX_MINUTES} minutes maximum (10 h).`,
} as const;

function parseMinutes(value: unknown): number | string {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(text)) return ERRORS.integer;
  const minutes = Number(text);
  if (minutes > TIME_SAVING_MAX_MINUTES) return ERRORS.tooHigh;
  return minutes;
}

/** Réponses valides (reçues du navigateur), ou message d'erreur. */
export function parseTimeSaving(input: unknown): TimeSavingAnswer | string {
  const data = (input ?? {}) as Record<string, unknown>;
  const before = parseMinutes(data.before);
  if (typeof before === "string") return before;
  if (before < TIME_SAVING_MIN_MINUTES) return ERRORS.beforeZero;
  const after = parseMinutes(data.after);
  if (typeof after === "string") return after;
  if (after < TIME_SAVING_MIN_MINUTES) return "Le temps avec Applyfy doit être d'au moins 1 minute.";
  return { before, after };
}

/** Gain en pourcentage (non arrondi) : 60 → 24 minutes donne 60. Négatif si « après » dépasse « avant ». */
export function gainPercent({ before, after }: TimeSavingAnswer): number {
  return ((before - after) * 100) / before;
}

/** Arrondi à l'entier inférieur (prudent), sans erreur de virgule flottante juste sous un entier. */
export function floorPercent(value: number): number {
  return Math.floor(value + 1e-9);
}

export type TimeSavingStats = {
  count: number;
  /** Moyenne des gains individuels, arrondie à l'entier inférieur ; null sans réponse. */
  meanPercent: number | null;
  /** Médiane des gains individuels, arrondie à l'entier inférieur ; null sans réponse. */
  medianPercent: number | null;
  /** Seuil de réponses atteint pour un chiffre public. */
  publicReady: boolean;
};

/** Statistiques sur toutes les réponses (gains négatifs ou nuls compris). */
export function timeSavingStats(answers: TimeSavingAnswer[]): TimeSavingStats {
  const gains = answers.map(gainPercent).sort((a, b) => a - b);
  const count = gains.length;
  if (count === 0) return { count, meanPercent: null, medianPercent: null, publicReady: false };
  const mean = gains.reduce((sum, gain) => sum + gain, 0) / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? gains[middle] : (gains[middle - 1] + gains[middle]) / 2;
  return {
    count,
    meanPercent: floorPercent(mean),
    medianPercent: floorPercent(median),
    publicReady: count >= TIME_SAVING_PUBLIC_MIN_RESPONSES,
  };
}

export type TimeSavingFlag = "negatif" | "nul" | "tres_eleve" | "avant_long";

export const TIME_SAVING_FLAG_LABELS: Record<TimeSavingFlag, string> = {
  negatif: "Gain négatif",
  nul: "Gain nul",
  tres_eleve: "Gain ≥ 90 %",
  avant_long: "Avant ≥ 300 min",
};

/** Signalements (admin) : servent à contacter la personne, jamais à exclure sa réponse. */
export function timeSavingFlags(answer: TimeSavingAnswer): TimeSavingFlag[] {
  const flags: TimeSavingFlag[] = [];
  const gain = gainPercent(answer);
  if (gain < 0) flags.push("negatif");
  else if (gain === 0) flags.push("nul");
  else if (gain >= 90) flags.push("tres_eleve");
  if (answer.before >= 300) flags.push("avant_long");
  return flags;
}

export type TimeSavingEligibility = "ok" | "retire" | "sans_candidature";

/** Peut répondre : testeur actif ou suspendu, avec au moins une vraie candidature. */
export function timeSavingEligibility(status: BetaStatus, realApplications: number): TimeSavingEligibility {
  if (status === "removed") return "retire";
  return realApplications > 0 ? "ok" : "sans_candidature";
}
