import "server-only";

import type { User } from "@supabase/supabase-js";

import { appUrl } from "./app-url";
import { buildActivationEmail } from "./email/activation-email";
import { isEmailConfigured, sendEmail } from "./email/brevo";
import { createAdminClient } from "./supabase/admin";
import { firstNameOf } from "./welcome-email";

// Tâche quotidienne (/api/cron/activation) : email J+2 aux comptes sans aucune candidature.
// Fenêtre de 24 h (comptes créés il y a 47 h à 71 h) : la tâche tournant une fois par jour,
// chaque compte y passe exactement une fois. Mémoire : activation_email_sent_at dans les
// métadonnées du compte, enregistré AVANT l'envoi (une double exécution n'envoie rien de plus).

const HOUR_MS = 3_600_000;
const MIN_AGE_MS = 47 * HOUR_MS;
const MAX_AGE_MS = 71 * HOUR_MS;
const PAGE = 1000;

export type ActivationJobResult = {
  dryRun: boolean;
  checked: number;
  sent: number;
  planned: string[];
  errors: { userId: string; error: string }[];
};

export async function runActivationJob({ dryRun = false, now = new Date() } = {}): Promise<ActivationJobResult> {
  if (!dryRun && !isEmailConfigured()) throw new Error("Brevo n'est pas configuré.");
  const supabase = createAdminClient();
  const result: ActivationJobResult = { dryRun, checked: 0, sent: 0, planned: [], errors: [] };

  // 1. Comptes créés dans la fenêtre, avec une adresse, pas encore relancés.
  const candidates: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Lecture des utilisateurs impossible : ${error.message}`);
    for (const user of data.users) {
      const age = now.getTime() - Date.parse(user.created_at);
      if (age < MIN_AGE_MS || age >= MAX_AGE_MS || !user.email) continue;
      if (typeof user.user_metadata?.activation_email_sent_at === "string") continue;
      candidates.push(user);
    }
    if (data.users.length < PAGE) break;
  }
  result.checked = candidates.length;
  if (candidates.length === 0) return result;

  // 2. Sans aucune candidature.
  const { data: apps, error } = await supabase
    .from("applications")
    .select("user_id")
    .in("user_id", candidates.map((u) => u.id));
  if (error) throw new Error(`Lecture des candidatures impossible : ${error.message}`);
  const withApplications = new Set((apps ?? []).map((a) => a.user_id as string));

  const base = appUrl();
  for (const user of candidates) {
    if (withApplications.has(user.id)) continue;
    result.planned.push(user.id);
    if (dryRun) continue;

    try {
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      // Réservation avant l'envoi (les métadonnées sont fusionnées, pas remplacées).
      const { error: markError } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { activation_email_sent_at: now.toISOString() },
      });
      if (markError) throw new Error(markError.message);

      try {
        await sendEmail(
          buildActivationEmail({
            to: user.email!,
            firstName: firstNameOf(metadata),
            dashboardUrl: `${base}/dashboard`,
            settingsUrl: `${base}/profil`,
          }),
        );
      } catch (sendError) {
        // Envoi raté : on libère la réservation pour réessayer au prochain passage.
        await supabase.auth.admin.updateUserById(user.id, { user_metadata: { activation_email_sent_at: null } });
        throw sendError;
      }
      result.sent += 1;
    } catch (jobError) {
      result.errors.push({ userId: user.id, error: jobError instanceof Error ? jobError.message : String(jobError) });
    }
  }

  return result;
}
