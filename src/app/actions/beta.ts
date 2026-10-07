"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { BetaError, joinBeta, submitBetaReport } from "@/lib/beta";
import { parseReportAnswers } from "@/lib/beta-rules";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type BetaActionResult = { ok: true } | { ok: false; error: string };

const DEMO_MESSAGE = "Le programme beta n'est pas disponible en mode démo.";

/** « Je m'engage et je rejoins la beta ». */
export async function joinBetaAction(): Promise<BetaActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: DEMO_MESSAGE };
  await requireUser();
  try {
    await joinBeta();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof BetaError) return { ok: false, error: error.message };
    console.error("[beta] inscription", error);
    return { ok: false, error: "L'inscription a échoué. Réessaie dans un instant." };
  }
  // Premium débloqué : toutes les pages qui affichent les limites sont rafraîchies.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Envoi d'un des 3 rapports beta (définitif). */
export async function submitBetaReportAction(number: number, input: unknown): Promise<BetaActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: DEMO_MESSAGE };
  await requireUser();
  if (![1, 2, 3].includes(number)) return { ok: false, error: "Rapport inconnu." };
  const answers = parseReportAnswers(number, input);
  if (typeof answers === "string") return { ok: false, error: answers };

  try {
    await submitBetaReport(number, answers);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof BetaError) return { ok: false, error: error.message };
    console.error("[beta] rapport", error);
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };
  }
  revalidatePath("/profil");
  return { ok: true };
}
