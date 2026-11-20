import "server-only";

import { after } from "next/server";

import {
  COACH_LIMIT_DAYS,
  coachLimitStats,
  type CoachLimitHitRow,
  type CoachLimitInfo,
  type CoachLimitStats,
  type CoachLimitSurface,
} from "./coach-limit-rules";
import { isMissingTable } from "./optional-columns";
import { isStripeConfigured } from "./stripe";
import { createAdminClient } from "./supabase/admin";

// Limite du coach (plan gratuit) : refus enregistrés dans coach_limit_hits (migration 0046), et
// données de l'écran de limite. Rien ici ne bloque ni ne ralentit la réponse au navigateur.

/** Données de l'écran de limite (CoachLimitScreen), envoyées avec le refus. */
export function coachLimitInfo(): CoachLimitInfo {
  return { paymentEnabled: isStripeConfigured() };
}

async function insertHit(userId: string, surface: CoachLimitSurface) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("coach_limit_hits").insert({ user_id: userId, surface });
    if (!error) return;
    if (isMissingTable(error)) console.error("[coach-limit] table absente (migration 0046) : refus non enregistré");
    else console.error("[coach-limit] enregistrement", error.message);
  } catch (error) {
    console.error("[coach-limit] enregistrement", error);
  }
}

/** Enregistre un refus après la réponse (after) : jamais bloquant, jamais en échec. */
export function recordCoachLimitHit(userId: string, surface: CoachLimitSurface) {
  try {
    after(() => insertHit(userId, surface));
  } catch (error) {
    // Hors d'une requête (tests, script) : rien à enregistrer.
    console.error("[coach-limit] enregistrement impossible hors requête", error);
  }
}

/** Statistiques de /admin ; « absente » si la migration 0046 n'est pas appliquée. */
export async function getCoachLimitAdminStats(
  now = new Date(),
): Promise<{ status: "ok"; stats: CoachLimitStats } | { status: "absente" } | { status: "erreur" }> {
  try {
    const since = new Date(now.getTime() - (COACH_LIMIT_DAYS + 1) * 86_400_000).toISOString();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("coach_limit_hits")
      .select("user_id, occurred_at, surface")
      .gte("occurred_at", since)
      .limit(10_000);
    if (error) {
      if (isMissingTable(error)) return { status: "absente" };
      console.error("[coach-limit] statistiques", error.message);
      return { status: "erreur" };
    }
    return { status: "ok", stats: coachLimitStats((data ?? []) as CoachLimitHitRow[], now) };
  } catch (error) {
    console.error("[coach-limit] statistiques", error);
    return { status: "erreur" };
  }
}
