import "server-only";

import { isEmailConfigured, sendEmail } from "./email/brevo";
import { buildReminderEmail } from "./email/reminder-email";
import { MAX_REMINDERS, REMINDER_STATUSES, daysBetween, dueReminder, readReminderSettings } from "./reminders";
import { createAdminClient } from "./supabase/admin";

type AppRow = {
  id: string;
  user_id: string;
  company: string;
  position: string;
  status: string;
  applied_at: string | null;
  last_contact_at: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
};

export type ReminderJobResult = {
  dryRun: boolean;
  checked: number;
  sent: number;
  planned: { applicationId: string; reminder: 1 | 2 }[];
  errors: { applicationId: string; error: string }[];
};

/** URL publique de l'app (liens des emails). */
function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/**
 * Tâche quotidienne : envoie les rappels de relance dus.
 * Chaque rappel est « réservé » en base (mise à jour conditionnelle du compteur) AVANT
 * l'envoi : une double exécution ne peut pas envoyer deux fois le même rappel.
 */
export async function runReminderJob({ dryRun = false, now = new Date() } = {}): Promise<ReminderJobResult> {
  if (!dryRun && !isEmailConfigured()) throw new Error("Brevo n'est pas configuré.");
  const supabase = createAdminClient();
  const result: ReminderJobResult = { dryRun, checked: 0, sent: 0, planned: [], errors: [] };

  const { data: apps, error } = await supabase
    .from("applications")
    .select("id, user_id, company, position, status, applied_at, last_contact_at, reminders_sent, last_reminder_at")
    .in("status", [...REMINDER_STATUSES])
    .not("applied_at", "is", null)
    .lt("reminders_sent", MAX_REMINDERS);
  if (error) throw new Error(`Lecture des candidatures impossible : ${error.message}`);
  result.checked = apps.length;
  if (apps.length === 0) return result;

  const userIds = [...new Set(apps.map((a) => a.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, reminders_enabled, first_reminder_days, second_reminder_days")
    .in("id", userIds);
  if (profilesError) throw new Error(`Lecture des préférences impossible : ${profilesError.message}`);
  const settingsByUser = new Map(profiles.map((p) => [p.id as string, readReminderSettings(p)]));

  const emails = new Map<string, string | null>();
  async function emailOf(userId: string) {
    if (!emails.has(userId)) {
      const { data } = await supabase.auth.admin.getUserById(userId);
      emails.set(userId, data.user?.email ?? null);
    }
    return emails.get(userId) ?? null;
  }

  for (const app of apps as AppRow[]) {
    const settings = settingsByUser.get(app.user_id) ?? readReminderSettings(null);
    const reminder = dueReminder(app, settings, now);
    if (!reminder) continue;
    result.planned.push({ applicationId: app.id, reminder });
    if (dryRun) continue;

    try {
      const to = await emailOf(app.user_id);
      if (!to) throw new Error("Adresse email introuvable.");

      // Réservation : ne réussit que si aucun autre passage n'a déjà envoyé ce rappel.
      const sentAt = now.toISOString();
      const { data: claimed, error: claimError } = await supabase
        .from("applications")
        .update({ reminders_sent: reminder, last_reminder_at: sentAt })
        .eq("id", app.id)
        .eq("reminders_sent", reminder - 1)
        .select("id");
      if (claimError) throw new Error(claimError.message);
      if (!claimed?.length) continue; // déjà traité

      const base = appUrl();
      try {
        await sendEmail(
          buildReminderEmail({
            to,
            company: app.company,
            position: app.position,
            daysSinceApplied: daysBetween(app.applied_at!, now),
            applicationUrl: `${base}/candidatures/${app.id}`,
            settingsUrl: `${base}/profil`,
          }),
        );
      } catch (sendError) {
        // Envoi raté : on libère la réservation pour réessayer au prochain passage.
        await supabase
          .from("applications")
          .update({ reminders_sent: reminder - 1, last_reminder_at: app.last_reminder_at })
          .eq("id", app.id);
        throw sendError;
      }

      const { error: eventError } = await supabase.from("application_events").insert({
        application_id: app.id,
        user_id: app.user_id,
        type: "rappel",
        content: `Rappel de relance n°${reminder} envoyé par email`,
        created_at: sentAt,
      });
      if (eventError) console.error("[reminders] historique", app.id, eventError.message);

      result.sent += 1;
    } catch (err) {
      result.errors.push({ applicationId: app.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
