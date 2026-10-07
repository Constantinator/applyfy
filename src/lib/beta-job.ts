import "server-only";

import { listAllUsers } from "./admin-metrics";
import { appUrl } from "./app-url";
import { BETA_REMINDER_DAYS_BEFORE, BETA_REPORTS, reportDeadline, reportOpensAt } from "./beta-rules";
import { buildBetaReminderEmail, buildBetaSuspensionEmail } from "./email/beta-emails";
import { isEmailConfigured, sendEmail } from "./email/brevo";
import { createAdminClient } from "./supabase/admin";

// Tâche quotidienne du programme beta (/api/cron/beta) :
//   1. rapport non soumis à sa date limite → accès beta suspendu + email explicatif ;
//   2. date limite dans 2 jours ou moins → email de rappel (une seule fois par rapport).
// Chaque action est « réservée » en base (mise à jour conditionnelle) AVANT l'envoi de
// l'email : une double exécution ne suspend ni ne relance deux fois.

export type BetaJobResult = {
  dryRun: boolean;
  checked: number;
  reminders: { userId: string; report: number }[];
  suspensions: { userId: string; report: number }[];
  errors: { userId: string; error: string }[];
};

type TesterRow = { user_id: string; joined_at: string; reminders_sent: number[] };

export async function runBetaJob({ dryRun = false, now = new Date() } = {}): Promise<BetaJobResult> {
  const supabase = createAdminClient();
  const [testers, reports, users] = await Promise.all([
    // Programme terminé (Premium offert expiré) : plus de rappels ni de suspensions.
    supabase
      .from("beta_testers")
      .select("user_id, joined_at, reminders_sent")
      .eq("status", "active")
      .gte("premium_until", now.toISOString().slice(0, 10)),
    supabase.from("beta_reports").select("user_id, report_number"),
    listAllUsers(supabase),
  ]);
  if (testers.error) throw new Error(`Lecture des beta testeurs impossible : ${testers.error.message}`);
  if (reports.error) throw new Error(`Lecture des rapports impossible : ${reports.error.message}`);

  const submitted = new Set((reports.data ?? []).map((r) => `${r.user_id}:${r.report_number}`));
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const emailEnabled = isEmailConfigured();
  const result: BetaJobResult = { dryRun, checked: 0, reminders: [], suspensions: [], errors: [] };

  for (const tester of (testers.data ?? []) as TesterRow[]) {
    result.checked += 1;
    const email = emailById.get(tester.user_id) ?? null;
    const pending = BETA_REPORTS.filter((def) => !submitted.has(`${tester.user_id}:${def.number}`));

    try {
      // 1. Premier rapport manqué : suspension (les rapports suivants ne comptent plus).
      const missed = pending.find((def) => now > reportDeadline(tester.joined_at, def.number));
      if (missed) {
        result.suspensions.push({ userId: tester.user_id, report: missed.number });
        if (dryRun) continue;
        const { data, error } = await supabase
          .from("beta_testers")
          .update({
            status: "suspended",
            suspended_at: now.toISOString(),
            suspension_reason: `${missed.title} (${missed.period.toLowerCase()}) non soumis à temps`,
          })
          .eq("user_id", tester.user_id)
          .eq("status", "active")
          .select("user_id");
        if (error) throw new Error(error.message);
        if (data?.length && email && emailEnabled) {
          await sendEmail(buildBetaSuspensionEmail({ to: email, reportTitle: missed.title, period: missed.period }));
        }
        continue;
      }

      // 2. Rappels : rapport ouvert, date limite dans 2 jours ou moins, rappel pas encore envoyé.
      for (const def of pending) {
        const deadline = reportDeadline(tester.joined_at, def.number);
        const remindFrom = deadline.getTime() - BETA_REMINDER_DAYS_BEFORE * 86_400_000;
        const due =
          now.getTime() >= remindFrom &&
          now >= reportOpensAt(tester.joined_at, def.number) &&
          !tester.reminders_sent.includes(def.number);
        if (!due || !email || !emailEnabled) continue;

        result.reminders.push({ userId: tester.user_id, report: def.number });
        if (dryRun) continue;
        // Réservation : n'aboutit que si le rappel n'a pas déjà été enregistré entre-temps.
        const { data, error } = await supabase
          .from("beta_testers")
          .update({ reminders_sent: [...tester.reminders_sent, def.number] })
          .eq("user_id", tester.user_id)
          .not("reminders_sent", "cs", `{${def.number}}`)
          .select("user_id");
        if (error) throw new Error(error.message);
        if (!data?.length) continue;
        tester.reminders_sent = [...tester.reminders_sent, def.number];
        await sendEmail(
          buildBetaReminderEmail({
            to: email,
            reportTitle: def.title,
            period: def.period,
            deadline,
            profileUrl: `${appUrl()}/profil#beta`,
          }),
        );
      }
    } catch (error) {
      result.errors.push({ userId: tester.user_id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
