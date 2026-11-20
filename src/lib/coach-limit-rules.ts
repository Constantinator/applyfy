// Limite du coach (plan gratuit) : surfaces des refus et statistiques de /admin (fonctions pures,
// testables). Valeurs alignées avec la migration 0046.

export const COACH_LIMIT_SURFACES = ["editeur", "panneau"] as const;
export type CoachLimitSurface = (typeof COACH_LIMIT_SURFACES)[number];

/** Écran de limite (CoachLimitScreen) : ce que le navigateur reçoit avec le refus. */
export type CoachLimitInfo = { paymentEnabled: boolean };

/** Jours affichés dans /admin. */
export const COACH_LIMIT_DAYS = 14;

const DAY_MS = 86_400_000;
const parisDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" });

export type CoachLimitHitRow = { user_id: string; occurred_at: string; surface: CoachLimitSurface };

export type CoachLimitStats = {
  /** Refus par jour (heure de Paris), du plus ancien au plus récent. */
  perDay: { day: string; value: number }[];
  total: number;
  /** Personnes différentes touchées sur la période. */
  people: number;
  bySurface: Record<CoachLimitSurface, number>;
};

/** Refus des `days` derniers jours (aujourd'hui compris). */
export function coachLimitStats(rows: CoachLimitHitRow[], now: Date, days = COACH_LIMIT_DAYS): CoachLimitStats {
  const dayList = Array.from({ length: days }, (_, i) => parisDay.format(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
  const counts = new Map(dayList.map((day) => [day, 0]));
  const people = new Set<string>();
  const bySurface: Record<CoachLimitSurface, number> = { editeur: 0, panneau: 0 };
  let total = 0;
  for (const row of rows) {
    const day = parisDay.format(new Date(row.occurred_at));
    if (!counts.has(day)) continue;
    counts.set(day, counts.get(day)! + 1);
    people.add(row.user_id);
    if (row.surface in bySurface) bySurface[row.surface]++;
    total++;
  }
  return { perDay: dayList.map((day) => ({ day, value: counts.get(day)! })), total, people: people.size, bySurface };
}
