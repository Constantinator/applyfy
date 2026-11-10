import "server-only";

import { requireUser } from "./auth";
import { demoStore } from "./demo-data";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Réservations des actions de Lumeo, sans nouvelle table ni migration : une seule exécution à la
// fois par (utilisateur, type, candidature), grâce à des mises à jour conditionnelles atomiques
// (Postgres verrouille la ligne ; une requête simultanée relit la condition et ne la trouve plus
// vraie) ou à l'index unique cv_builder(application_id). Une réservation restée en place après un
// arrêt brutal expire au bout de LUMEO_CLAIM_STALE_MS.

export const LUMEO_CLAIM_STALE_MS = 5 * 60_000;
const staleBefore = () => new Date(Date.now() - LUMEO_CLAIM_STALE_MS).toISOString();

async function scoped() {
  const user = await requireUser();
  const supabase = await createClient();
  return { user, supabase };
}

// --- Lettre : cover_letter_at posé tant qu'aucune lettre n'est enregistrée ----------------------

export async function claimLetter(applicationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === applicationId) as { cover_letter_html?: string | null; cover_letter_at?: string | null } | undefined;
    if (!app || app.cover_letter_html || (app.cover_letter_at && app.cover_letter_at > staleBefore())) return false;
    app.cover_letter_at = new Date().toISOString();
    return true;
  }
  const { user, supabase } = await scoped();
  const { data, error } = await supabase
    .from("applications")
    .update({ cover_letter_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .is("cover_letter_html", null)
    .or(`cover_letter_at.is.null,cover_letter_at.lt."${staleBefore()}"`)
    .select("id");
  if (error) throw new Error(`Réservation de la lettre impossible : ${error.message}`);
  return (data?.length ?? 0) === 1;
}

/** Échec : la lettre n'a pas été enregistrée, la réservation est retirée. */
export async function releaseLetter(applicationId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === applicationId) as { cover_letter_html?: string | null; cover_letter_at?: string | null } | undefined;
    if (app && !app.cover_letter_html) app.cover_letter_at = null;
    return;
  }
  const { user, supabase } = await scoped();
  await supabase
    .from("applications")
    .update({ cover_letter_at: null })
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .is("cover_letter_html", null);
}

// --- Résumé : offer_summary vide ('') pendant la génération, seulement s'il était absent --------

export async function claimSummary(applicationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === applicationId) as { offer_summary?: string | null } | undefined;
    if (!app || (app.offer_summary ?? null) !== null) return false;
    app.offer_summary = "";
    return true;
  }
  const { user, supabase } = await scoped();
  // updated_at est mis à jour par le trigger de la table : il date la réservation.
  const { data, error } = await supabase
    .from("applications")
    .update({ offer_summary: "" })
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .or(`offer_summary.is.null,and(offer_summary.eq."",updated_at.lt."${staleBefore()}")`)
    .select("id");
  if (error) throw new Error(`Réservation du résumé impossible : ${error.message}`);
  return (data?.length ?? 0) === 1;
}

/** Enregistre le résumé à la place de la réservation (jamais par-dessus un résumé existant). */
export async function saveClaimedSummary(applicationId: string, summary: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === applicationId) as { offer_summary?: string | null } | undefined;
    if (!app || app.offer_summary !== "") return false;
    app.offer_summary = summary;
    return true;
  }
  const { user, supabase } = await scoped();
  const { data, error } = await supabase
    .from("applications")
    .update({ offer_summary: summary })
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .eq("offer_summary", "")
    .select("id");
  if (error) throw new Error(`Enregistrement du résumé impossible : ${error.message}`);
  return (data?.length ?? 0) === 1;
}

export async function releaseSummary(applicationId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const app = demoStore.applications.find((a) => a.id === applicationId) as { offer_summary?: string | null } | undefined;
    if (app?.offer_summary === "") app.offer_summary = null;
    return;
  }
  const { user, supabase } = await scoped();
  await supabase.from("applications").update({ offer_summary: null }).eq("id", applicationId).eq("user_id", user.id).eq("offer_summary", "");
}
