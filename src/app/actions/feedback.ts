"use server";

import { unstable_rethrow } from "next/navigation";

import { getMyFeedback, saveMyFeedback } from "@/lib/feedback";
import { parseFeedback, type Feedback } from "@/lib/feedback-options";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type LoadFeedbackResult = { ok: true; feedback: Feedback | null } | { ok: false; error: string };
export type SaveFeedbackResult = { ok: true } | { ok: false; error: string };

const DEMO_MESSAGE = "Les avis ne sont pas disponibles en mode démo.";

/** Avis déjà donné, pour pré-remplir le formulaire à son ouverture. */
export async function loadFeedbackAction(): Promise<LoadFeedbackResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: DEMO_MESSAGE };
  try {
    return { ok: true, feedback: await getMyFeedback() };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[feedback] lecture", error);
    return { ok: false, error: "Ton avis n'a pas pu être chargé. Réessaie dans un instant." };
  }
}

/** Enregistre (ou modifie) l'avis de l'utilisateur connecté. */
export async function saveFeedbackAction(input: unknown): Promise<SaveFeedbackResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: DEMO_MESSAGE };
  const feedback = parseFeedback(input);
  if (typeof feedback === "string") return { ok: false, error: feedback };
  try {
    await saveMyFeedback(feedback);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[feedback] enregistrement", error);
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };
  }
}
