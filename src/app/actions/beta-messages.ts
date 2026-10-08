"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireAdmin } from "@/lib/admin-metrics";
import { requireUser } from "@/lib/auth";
import { listBetaTesters } from "@/lib/beta-admin";
import {
  BETA_MESSAGE_MAX_LENGTH,
  BetaMessageError,
  markMyBetaMessagesRead,
  markTesterMessagesRead,
  sendAdminBetaMessage,
  sendMyBetaMessage,
} from "@/lib/beta-messages";

export type MessageActionResult = { ok: true; message?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBody(body: unknown): string | { error: string } {
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { error: "Écris ton message." };
  if (text.length > BETA_MESSAGE_MAX_LENGTH) return { error: "Message trop long (5 000 caractères max)." };
  return text;
}

// ---------------------------------------------------------------------------
// Beta testeur (/beta)
// ---------------------------------------------------------------------------

/** Message du beta testeur connecté à l'équipe Applyfy. */
export async function sendMyBetaMessageAction(body: string): Promise<MessageActionResult> {
  await requireUser();
  const text = readBody(body);
  if (typeof text !== "string") return { ok: false, error: text.error };
  try {
    await sendMyBetaMessage(text);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof BetaMessageError) return { ok: false, error: error.message };
    console.error("[beta-messages] envoi", error);
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };
  }
  revalidatePath("/beta");
  return { ok: true };
}

/** Le beta testeur a ouvert sa messagerie : les messages de l'équipe sont lus. */
export async function markMyBetaMessagesReadAction(): Promise<void> {
  await requireUser();
  await markMyBetaMessagesRead().catch((error) => console.error("[beta-messages] lecture", error));
}

// ---------------------------------------------------------------------------
// Équipe (/admin/beta)
// ---------------------------------------------------------------------------

/** Message interne à un beta testeur (son id) ou à tous les testeurs actifs (`"all"`). */
export async function sendAdminBetaMessageAction(input: { target: string; body: string }): Promise<MessageActionResult> {
  await requireAdmin();
  const text = readBody(input?.body);
  if (typeof text !== "string") return { ok: false, error: text.error };
  const target = typeof input?.target === "string" ? input.target : "";
  if (target !== "all" && !UUID.test(target)) return { ok: false, error: "Destinataire invalide." };

  try {
    const testers = (await listBetaTesters()) ?? [];
    const ids =
      target === "all"
        ? testers.filter((t) => t.status === "active").map((t) => t.userId)
        : testers.filter((t) => t.userId === target).map((t) => t.userId);
    if (ids.length === 0) return { ok: false, error: "Aucun destinataire." };
    const sent = await sendAdminBetaMessage(ids, text);
    revalidatePath("/admin/beta");
    return { ok: true, message: target === "all" ? `Message envoyé à ${sent} beta testeur${sent > 1 ? "s" : ""}.` : undefined };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[beta-messages] envoi admin", error);
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };
  }
}

/** L'équipe a ouvert le fil d'un beta testeur : ses messages sont lus. */
export async function markThreadReadAction(testerId: string): Promise<void> {
  await requireAdmin();
  if (typeof testerId !== "string" || !UUID.test(testerId)) return;
  await markTesterMessagesRead(testerId).catch((error) => console.error("[beta-messages] lecture admin", error));
}
