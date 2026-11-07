"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { parseWeeklyGoal } from "@/lib/dashboard-week";
import { WeeklyGoalUnavailableError, saveWeeklyGoal } from "@/lib/profile";

export type WeeklyGoalResult = { ok: true } | { ok: false; error: string };

/** Enregistre l'objectif de la semaine ; champ vide : objectif retiré. */
export async function saveWeeklyGoalAction(value: unknown): Promise<WeeklyGoalResult> {
  const parsed = parseWeeklyGoal(value);
  if (!parsed.ok) return parsed;

  try {
    await saveWeeklyGoal(parsed.goal);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error); // redirection vers /login si la session a expiré
    if (error instanceof WeeklyGoalUnavailableError) {
      return { ok: false, error: "L'objectif n'est pas encore disponible. Réessaie un peu plus tard." };
    }
    console.error("[saveWeeklyGoal]", error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
}
