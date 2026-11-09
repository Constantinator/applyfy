import "server-only";

import { isUnsubscribed } from "./email/unsubscribe-token";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Préférence « Recevoir les e-mails d'Applyfy » (profil) : métadonnée emails_unsubscribed_at du
// compte connecté, la même que le lien de désinscription. Les e-mails de service (accès bêta,
// compte) ne la consultent pas.

/** Le compte connecté reçoit les e-mails (vrai en mode démo ou sans session). */
export async function getEmailsSubscribed(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return !isUnsubscribed(data.user?.user_metadata);
}

/** Réinscrit (null) ou désinscrit (date du jour) le compte connecté, avec sa propre session. */
export async function setEmailsSubscribed(subscribed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { emails_unsubscribed_at: subscribed ? null : new Date().toISOString() },
  });
  if (error) throw new Error(error.message);
}
