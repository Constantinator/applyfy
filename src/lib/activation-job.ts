import "server-only";

import type { User } from "@supabase/supabase-js";

import { appUrl } from "./app-url";
import { buildActivationEmail } from "./email/activation-email";
import { isEmailConfigured, sendEmail } from "./email/brevo";
import { isUnsubscribed } from "./email/unsubscribe-token";
import { onboardingEmailVariant, type OnboardingProgressRead } from "./onboarding";
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
      if (isUnsubscribed(user.user_metadata)) continue;
      candidates.push(user);
    }
    if (data.users.length < PAGE) break;
  }
  result.checked = candidates.length;
  if (candidates.length === 0) return result;

  // 2. Sans aucune vraie candidature (la candidature exemple ne compte pas).
  const { data: apps, error } = await supabase
    .from("applications")
    .select("user_id")
    .in("user_id", candidates.map((u) => u.id))
    .eq("is_example", false);
  if (error) throw new Error(`Lecture des candidatures impossible : ${error.message}`);
  const withApplications = new Set((apps ?? []).map((a) => a.user_id as string));

  // Parcours d'accueil : variante du texte. Lecture impossible ou table absente : variante « fini ».
  const progress = await readProgress(supabase, candidates.map((u) => u.id));

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
            baseUrl: base,
            userId: user.id,
            variant: onboardingEmailVariant({
              createdAt: user.created_at,
              metadataCompleted: typeof metadata.onboarding_completed_at === "string",
              progress: progress === "illisible" ? "illisible" : (progress.get(user.id) ?? null),
            }),
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

/** Parcours d'accueil des comptes donnés ; « illisible » si la lecture échoue (table absente…). */
async function readProgress(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, Exclude<OnboardingProgressRead, "illisible" | null>> | "illisible"> {
  try {
    const { data, error } = await supabase.from("onboarding_progress").select("user_id, completed_at").in("user_id", userIds);
    if (error) {
      console.error("[activation] parcours d'accueil illisible", error.message);
      return "illisible";
    }
    return new Map((data ?? []).map((row) => [row.user_id as string, { completed: Boolean(row.completed_at) }]));
  } catch (error) {
    console.error("[activation] parcours d'accueil illisible", error);
    return "illisible";
  }
}
