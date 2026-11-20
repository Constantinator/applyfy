import "server-only";

import type { User } from "@supabase/supabase-js";
import { after } from "next/server";

import { appUrl } from "./app-url";
import { isEmailConfigured, sendEmail } from "./email/brevo";
import { isUnsubscribed } from "./email/unsubscribe-token";
import { buildWelcomeEmail } from "./email/welcome-email";
import { onboardingEmailVariant, type OnboardingProgressRead } from "./onboarding";
import { isMissingTable } from "./optional-columns";
import { cleanNamePart } from "./person-name";
import type { createClient } from "./supabase/server";

// Email de bienvenue : envoyé une seule fois, dès que le compte est utilisable (inscription
// sans confirmation, lien de confirmation cliqué, première connexion Google). Mémoire :
// welcome_email_sent_at dans les métadonnées du compte.

/** Au-delà, le compte n'est plus « nouveau » (comptes créés avant l'email de bienvenue). */
const NEW_ACCOUNT_WINDOW_MS = 48 * 3_600_000;

/** Prénom : celui de l'inscription, sinon celui du compte Google. */
export function firstNameOf(metadata: Record<string, unknown>) {
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim().split(/\s+/)[0] : null;
  return cleanNamePart(metadata.first_name) || cleanNamePart(metadata.given_name) || cleanNamePart(fullName);
}

/**
 * Programme l'email de bienvenue (envoyé après la réponse) si le compte vient d'être créé et
 * ne l'a pas encore reçu. Sans échec : une erreur est journalisée, l'inscription continue.
 */
export async function queueWelcomeEmail(supabase: Awaited<ReturnType<typeof createClient>>, user: User | null) {
  try {
    if (!user?.email || !isEmailConfigured()) return;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof metadata.welcome_email_sent_at === "string" || isUnsubscribed(metadata)) return;
    if (Date.now() - Date.parse(user.created_at) > NEW_ACCOUNT_WINDOW_MS) return;

    // Marqué avant l'envoi : un second clic sur le lien de confirmation ne renvoie rien.
    const { error } = await supabase.auth.updateUser({ data: { welcome_email_sent_at: new Date().toISOString() } });
    if (error) throw new Error(error.message);

    const variant = onboardingEmailVariant({
      createdAt: user.created_at,
      metadataCompleted: typeof metadata.onboarding_completed_at === "string",
      progress: await readOwnProgress(supabase, user.id),
    });
    const message = buildWelcomeEmail({
      to: user.email,
      firstName: firstNameOf(metadata),
      baseUrl: appUrl(),
      userId: user.id,
      variant,
    });
    after(() => sendEmail(message).catch((sendError) => console.error("[welcome-email] envoi", sendError)));
  } catch (error) {
    console.error("[welcome-email]", error);
  }
}

/** Parcours d'accueil du compte (sa propre ligne, RLS) ; « illisible » si la lecture échoue. */
async function readOwnProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<OnboardingProgressRead> {
  try {
    const { data, error } = await supabase.from("onboarding_progress").select("completed_at").eq("user_id", userId).maybeSingle();
    if (error) {
      if (!isMissingTable(error)) console.error("[welcome-email] parcours", error.message);
      return "illisible";
    }
    return data ? { completed: Boolean(data.completed_at) } : null;
  } catch (error) {
    console.error("[welcome-email] parcours", error);
    return "illisible";
  }
}
