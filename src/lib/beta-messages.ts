import "server-only";

import { getCurrentUser } from "./auth";
import { createAdminClient } from "./supabase/admin";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Messagerie interne du programme beta (table beta_messages, migration 0018) : un fil par
// beta testeur, entre lui et l'équipe.
//   - côté testeur : sa session (RLS), envoi et lecture via send_beta_message et
//     mark_beta_messages_read ;
//   - côté équipe : client service_role, à n'appeler qu'après requireAdmin().

export const BETA_MESSAGE_MAX_LENGTH = 5000;

export type BetaMessage = {
  id: string;
  sender: "admin" | "tester";
  body: string;
  createdAt: string;
  readAt: string | null;
};

type MessageRow = { id: string; tester_id: string; sender: "admin" | "tester"; body: string; created_at: string; read_at: string | null };

const toMessage = (row: MessageRow): BetaMessage => ({
  id: row.id,
  sender: row.sender,
  body: row.body,
  createdAt: row.created_at,
  readAt: row.read_at,
});

export class BetaMessageError extends Error {}

// ---------------------------------------------------------------------------
// Côté beta testeur
// ---------------------------------------------------------------------------

/** Fil de l'utilisateur connecté, du plus ancien au plus récent ([] si indisponible). */
export async function getMyBetaMessages(): Promise<BetaMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_messages")
    .select("id, tester_id, sender, body, created_at, read_at")
    .eq("tester_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[beta-messages] lecture", error.message);
    return [];
  }
  return (data as MessageRow[]).map(toMessage);
}

/** Messages de l'équipe non lus par l'utilisateur connecté (badge « Beta testing »). */
export async function countMyUnreadBetaMessages(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const user = await getCurrentUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("beta_messages")
    .select("id", { count: "exact", head: true })
    .eq("tester_id", user.id)
    .eq("sender", "admin")
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
}

export async function sendMyBetaMessage(body: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_beta_message", { p_body: body });
  if (error) {
    if (error.message === "non_inscrit") throw new BetaMessageError("Tu ne fais pas partie du programme beta.");
    throw new Error(`Envoi du message impossible : ${error.message}`);
  }
}

export async function markMyBetaMessagesRead() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_beta_messages_read");
  if (error) throw new Error(`Lecture des messages impossible : ${error.message}`);
}

// ---------------------------------------------------------------------------
// Côté équipe (après requireAdmin)
// ---------------------------------------------------------------------------

/** Tous les messages, regroupés par fil (testeur) ; null si la table n'existe pas. */
export async function listBetaThreads(): Promise<Map<string, BetaMessage[]> | null> {
  const { data, error } = await createAdminClient()
    .from("beta_messages")
    .select("id, tester_id, sender, body, created_at, read_at")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    console.error("[beta-messages] lecture admin", error.message);
    return null;
  }
  const threads = new Map<string, BetaMessage[]>();
  for (const row of data as MessageRow[]) {
    threads.set(row.tester_id, [...(threads.get(row.tester_id) ?? []), toMessage(row)]);
  }
  return threads;
}

/** Messages des testeurs pas encore lus par l'équipe (badge « Beta testeurs »). */
export async function countUnreadForAdmin(): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("beta_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender", "tester")
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
}

/** Message de l'équipe dans le fil de chaque destinataire (ids de beta testeurs). */
export async function sendAdminBetaMessage(testerIds: string[], body: string) {
  if (testerIds.length === 0) return 0;
  const { error } = await createAdminClient()
    .from("beta_messages")
    .insert(testerIds.map((tester_id) => ({ tester_id, sender: "admin", body })));
  if (error) throw new Error(`Envoi du message impossible : ${error.message}`);
  return testerIds.length;
}

/** L'équipe a lu les messages d'un fil (ou de tous les fils). */
export async function markTesterMessagesRead(testerId?: string) {
  let query = createAdminClient()
    .from("beta_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender", "tester")
    .is("read_at", null);
  if (testerId) query = query.eq("tester_id", testerId);
  const { error } = await query;
  if (error) throw new Error(`Lecture des messages impossible : ${error.message}`);
}
