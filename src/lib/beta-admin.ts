import "server-only";

import { listAllUsers } from "./admin-metrics";
import {
  BETA_REPORTS,
  reportDeadline,
  reportStatus,
  type BetaReportAnswers,
  type BetaReportStatus,
  type BetaStatus,
} from "./beta-rules";
import { buildBetaMessageEmail } from "./email/beta-emails";
import { isEmailConfigured, sendEmail } from "./email/brevo";
import { createAdminClient } from "./supabase/admin";

// Tableau de bord des beta testeurs (/admin/beta) : lecture de tous les testeurs et
// rapports, retrait d'accès et messages par email. Client service_role, à n'appeler
// qu'après requireAdmin().

export type BetaTesterReport = {
  number: number;
  deadline: string;
  status: BetaReportStatus;
  submittedAt: string | null;
  answers: BetaReportAnswers | null;
};

export type BetaTester = {
  userId: string;
  email: string;
  status: BetaStatus;
  joinedAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  submittedCount: number;
  reports: BetaTesterReport[];
};

export type BetaActivity = {
  kind: "soumis" | "en_retard" | "suspendu";
  email: string;
  /** Rapport concerné (soumis, en retard). */
  report: number | null;
  date: string;
  detail: string | null;
};

type TesterRow = {
  user_id: string;
  status: BetaStatus;
  joined_at: string;
  suspended_at: string | null;
  suspension_reason: string | null;
};
type ReportRow = { user_id: string; report_number: number; submitted_at: string; answers: BetaReportAnswers };

/** Tous les beta testeurs ; null si les tables n'existent pas (migration 0017 non appliquée). */
export async function listBetaTesters(now = new Date()): Promise<BetaTester[] | null> {
  const supabase = createAdminClient();
  const [testers, reports, users] = await Promise.all([
    supabase
      .from("beta_testers")
      .select("user_id, status, joined_at, suspended_at, suspension_reason")
      .order("joined_at", { ascending: false }),
    supabase.from("beta_reports").select("user_id, report_number, submitted_at, answers"),
    listAllUsers(supabase),
  ]);
  if (testers.error || reports.error) {
    console.error("[beta-admin] lecture", testers.error?.message ?? reports.error?.message);
    return null;
  }

  const emailById = new Map(users.map((u) => [u.id, u.email ?? "(sans email)"]));
  const reportsByUser = new Map<string, ReportRow[]>();
  for (const report of (reports.data ?? []) as ReportRow[]) {
    reportsByUser.set(report.user_id, [...(reportsByUser.get(report.user_id) ?? []), report]);
  }

  return ((testers.data ?? []) as TesterRow[]).map((t) => {
    const submitted = reportsByUser.get(t.user_id) ?? [];
    return {
      userId: t.user_id,
      email: emailById.get(t.user_id) ?? "(compte supprimé)",
      status: t.status,
      joinedAt: t.joined_at,
      suspendedAt: t.suspended_at,
      suspensionReason: t.suspension_reason,
      submittedCount: submitted.length,
      reports: BETA_REPORTS.map(({ number }) => {
        const report = submitted.find((r) => r.report_number === number);
        return {
          number,
          deadline: reportDeadline(t.joined_at, number).toISOString(),
          status: reportStatus(t.joined_at, number, report?.submitted_at ?? null, now),
          submittedAt: report?.submitted_at ?? null,
          answers: report?.answers ?? null,
        };
      }),
    };
  });
}

/**
 * Activité récente (30 derniers jours), du plus récent au plus ancien : rapports soumis,
 * rapports en retard (testeurs encore actifs) et suspensions.
 */
export function betaActivity(testers: BetaTester[], now = new Date()): BetaActivity[] {
  const since = now.getTime() - 30 * 86_400_000;
  const events: BetaActivity[] = [];
  for (const t of testers) {
    for (const r of t.reports) {
      if (r.submittedAt) {
        events.push({ kind: "soumis", email: t.email, report: r.number, date: r.submittedAt, detail: null });
      } else if (r.status === "en_retard" && t.status === "active") {
        events.push({ kind: "en_retard", email: t.email, report: r.number, date: r.deadline, detail: null });
      }
    }
    if (t.status !== "active" && t.suspendedAt) {
      events.push({ kind: "suspendu", email: t.email, report: null, date: t.suspendedAt, detail: t.suspensionReason });
    }
  }
  return events.filter((e) => new Date(e.date).getTime() >= since).sort((a, b) => b.date.localeCompare(a.date));
}

/** Retire l'accès beta (et le Premium offert) d'un testeur. */
export async function removeBetaAccess(userId: string) {
  const { data, error } = await createAdminClient()
    .from("beta_testers")
    .update({ status: "removed", suspended_at: new Date().toISOString(), suspension_reason: "Accès retiré par l'équipe" })
    .eq("user_id", userId)
    .neq("status", "removed")
    .select("user_id");
  if (error) throw new Error(`Retrait de l'accès beta impossible : ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Envoie un message par email à un testeur, ou à tous les testeurs actifs (`"all"`).
 * Retourne le nombre d'emails envoyés et les adresses en échec.
 */
export async function sendBetaMessage(target: string, subject: string, message: string) {
  if (!isEmailConfigured()) throw new Error("Brevo n'est pas configuré (BREVO_API_KEY, BREVO_SENDER_EMAIL).");
  const testers = (await listBetaTesters()) ?? [];
  const recipients =
    target === "all" ? testers.filter((t) => t.status === "active") : testers.filter((t) => t.userId === target);
  const emails = recipients.map((t) => t.email).filter((email) => email.includes("@"));

  let sent = 0;
  const failed: string[] = [];
  for (const to of emails) {
    try {
      await sendEmail(buildBetaMessageEmail({ to, subject, message }));
      sent += 1;
    } catch (error) {
      console.error("[beta-admin] message", to, error);
      failed.push(to);
    }
  }
  return { sent, failed, recipients: emails.length };
}
