import "server-only";

import { cache } from "react";

import { getCurrentUser } from "./auth";
import { BETA_PREMIUM_UNTIL, type BetaReportAnswers, type BetaStatus } from "./beta-rules";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Participation de l'utilisateur connecté au programme beta (tables beta_testers et
// beta_reports, migration 0017). Lecture avec sa session (RLS) ; l'inscription et les
// rapports passent par les fonctions join_beta et submit_beta_report, qui appliquent les
// règles (30 places, délais).

export type MyBetaReport = { number: number; submittedAt: string; answers: BetaReportAnswers };

export type MyBeta = {
  status: BetaStatus;
  joinedAt: string;
  premiumUntil: string;
  suspensionReason: string | null;
  reports: MyBetaReport[];
};

export class BetaError extends Error {}

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" }).format(
    new Date(),
  );

/** Beta testeur actif dont le Premium offert court encore (aligné avec is_premium). */
export function hasBetaPremium(beta: MyBeta | null) {
  return beta?.status === "active" && beta.premiumUntil >= parisToday();
}

/**
 * Participation de l'utilisateur connecté, ou null (pas inscrit, mode démo). Sans échec :
 * si les tables sont illisibles (migration non appliquée…), il n'est pas beta testeur.
 */
export const getMyBeta = cache(async (): Promise<MyBeta | null> => {
  if (!isSupabaseConfigured()) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [tester, reports] = await Promise.all([
    supabase
      .from("beta_testers")
      .select("status, joined_at, premium_until, suspension_reason")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("beta_reports").select("report_number, submitted_at, answers").eq("user_id", user.id),
  ]);
  if (tester.error) {
    console.error("[beta] lecture", tester.error.message);
    return null;
  }
  if (!tester.data) return null;

  return {
    status: tester.data.status,
    joinedAt: tester.data.joined_at,
    premiumUntil: tester.data.premium_until ?? BETA_PREMIUM_UNTIL,
    suspensionReason: tester.data.suspension_reason,
    reports: (reports.data ?? []).map((r) => ({
      number: r.report_number,
      submittedAt: r.submitted_at,
      answers: r.answers as BetaReportAnswers,
    })),
  };
});

/** Places encore disponibles (0 si le programme est complet ou illisible). */
export async function getBetaSpotsLeft(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("beta_spots_left");
  if (error) {
    console.error("[beta] places restantes", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

const JOIN_ERRORS: Record<string, string> = {
  deja_inscrit: "Tu fais déjà partie du programme beta.",
  complet: "Les 30 places de la beta sont prises. Merci pour ton intérêt !",
};

const REPORT_ERRORS: Record<string, string> = {
  non_inscrit: "Tu ne fais pas partie du programme beta.",
  suspendu: "Ton accès beta est suspendu : ce rapport ne peut plus être envoyé.",
  pas_encore_ouvert: "Ce rapport n'est pas encore ouvert.",
  en_retard: "La date limite de ce rapport est dépassée.",
  deja_soumis: "Ce rapport a déjà été envoyé.",
  rapport_invalide: "Rapport inconnu.",
};

export async function joinBeta() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_beta");
  if (error) {
    if (JOIN_ERRORS[error.message]) throw new BetaError(JOIN_ERRORS[error.message]);
    throw new Error(`Inscription à la beta impossible : ${error.message}`);
  }
}

export async function submitBetaReport(number: number, answers: BetaReportAnswers) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_beta_report", { p_number: number, p_answers: answers });
  if (error) {
    if (REPORT_ERRORS[error.message]) throw new BetaError(REPORT_ERRORS[error.message]);
    throw new Error(`Envoi du rapport impossible : ${error.message}`);
  }
}
