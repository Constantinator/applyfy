// Carte « Ton plan gratuit » du tableau de bord (fonctions pures, testables). Limites lues à la
// même source que les quotas, jamais recopiées ici.
import { AI_MONTHLY_LIMITS, CVB_COACH_DAILY_LIMIT } from "./ai-usage-limits";
import { parisDay } from "./dashboard-week";

/** Ni Premium (abonnement), ni beta testeur actif, ni admin. */
export function isFreeAccount(account: { premium: boolean; betaActive: boolean; admin: boolean }) {
  return !account.premium && !account.betaActive && !account.admin;
}

export type FreePlanCounts = { adaptations: number; coachToday: number; imports: number };

/** Lignes du mois de la table « usage » : le coach se compte sur le jour en cours, à l'heure de Paris. */
export function countFreePlanUsage(rows: { kind: string; created_at: string }[], now: Date): FreePlanCounts {
  const today = parisDay(now);
  const counts: FreePlanCounts = { adaptations: 0, coachToday: 0, imports: 0 };
  for (const row of rows) {
    if (row.kind === "cvb_chat") counts.adaptations += 1;
    if (row.kind === "cvb_import") counts.imports += 1;
    if (row.kind === "cvb_coach" && parisDay(new Date(row.created_at)) === today) counts.coachToday += 1;
  }
  return counts;
}

export type FreePlanLine = { label: string; used: number; limit: number; percent: number; reached: boolean };

function line(label: string, count: number, limit: number): FreePlanLine {
  const used = Math.min(count, limit);
  return { label, used, limit, percent: Math.round((used / limit) * 100), reached: count >= limit };
}

export function buildFreePlanLines(counts: FreePlanCounts): FreePlanLine[] {
  return [
    line("Adaptations de CV ce mois", counts.adaptations, AI_MONTHLY_LIMITS.cvb_chat),
    line("Questions au Chat IA aujourd'hui", counts.coachToday, CVB_COACH_DAILY_LIMIT),
    line("Import de CV ce mois", counts.imports, AI_MONTHLY_LIMITS.cvb_import),
  ];
}
