import "server-only";

import type { User } from "@supabase/supabase-js";

import { today } from "./applications";
import type { createClient } from "./supabase/server";

// Candidature exemple : créée une seule fois, dès que le compte est utilisable (mêmes
// déclencheurs que l'email de bienvenue), pour montrer le produit en action. Mémoire :
// example_application_created_at dans les métadonnées du compte. Supprimable comme les autres.

/** Au-delà, le compte n'est plus « nouveau » (comptes créés avant cette fonctionnalité). */
const NEW_ACCOUNT_WINDOW_MS = 48 * 3_600_000;

/** Sans échec : une erreur est journalisée, l'inscription continue. */
export async function createExampleApplication(supabase: Awaited<ReturnType<typeof createClient>>, user: User | null) {
  try {
    if (!user) return;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof metadata.example_application_created_at === "string") return;
    if (Date.now() - Date.parse(user.created_at) > NEW_ACCOUNT_WINDOW_MS) return;

    // Marqué avant la création : un second clic sur le lien de confirmation ne crée rien.
    const { error: markError } = await supabase.auth.updateUser({
      data: { example_application_created_at: new Date().toISOString() },
    });
    if (markError) throw new Error(markError.message);

    const appliedAt = today();
    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        company: "Leboncoin",
        position: "Chargé(e) de recrutement",
        status: "en_attente",
        applied_at: appliedAt,
        last_contact_at: appliedAt,
        notes: "Offre vue sur LinkedIn",
        is_example: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Création impossible.");

    const now = new Date().toISOString();
    const { error: eventsError } = await supabase.from("application_events").insert([
      { application_id: data.id, user_id: user.id, type: "creation", content: "Exemple ajouté par Applyfy", created_at: now },
      { application_id: data.id, user_id: user.id, type: "envoi", content: null, created_at: now },
    ]);
    if (eventsError) throw new Error(eventsError.message);
  } catch (error) {
    console.error("[example-application]", error);
  }
}
