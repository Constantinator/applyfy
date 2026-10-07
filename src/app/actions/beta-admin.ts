"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireAdmin } from "@/lib/admin-metrics";
import { removeBetaAccess, sendBetaMessage } from "@/lib/beta-admin";

export type BetaAdminResult = { ok: true; message: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT_MAX_LENGTH = 150;
const MESSAGE_MAX_LENGTH = 5000;

/** Email à un beta testeur (`target` = son id) ou à tous les testeurs actifs (`"all"`). */
export async function sendBetaMessageAction(input: {
  target: string;
  subject: string;
  message: string;
}): Promise<BetaAdminResult> {
  await requireAdmin();
  const target = typeof input?.target === "string" ? input.target : "";
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (target !== "all" && !UUID.test(target)) return { ok: false, error: "Destinataire invalide." };
  if (!subject || subject.length > SUBJECT_MAX_LENGTH) return { ok: false, error: "Objet requis (150 caractères max)." };
  if (!message || message.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "Message requis (5 000 caractères max)." };

  try {
    const { sent, failed, recipients } = await sendBetaMessage(target, subject, message);
    if (recipients === 0) return { ok: false, error: "Aucun destinataire (aucun beta testeur actif)." };
    if (failed.length) {
      return { ok: false, error: `${sent} envoyé(s), échec pour : ${failed.join(", ")}.` };
    }
    return { ok: true, message: `Message envoyé à ${sent} beta testeur${sent > 1 ? "s" : ""}.` };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[beta-admin] message", error);
    return { ok: false, error: error instanceof Error ? error.message : "Envoi impossible." };
  }
}

/** « Retirer l'accès beta » : le testeur repasse au plan gratuit. */
export async function removeBetaAccessAction(userId: string): Promise<BetaAdminResult> {
  await requireAdmin();
  if (typeof userId !== "string" || !UUID.test(userId)) return { ok: false, error: "Beta testeur invalide." };
  try {
    const removed = await removeBetaAccess(userId);
    revalidatePath("/admin/beta");
    return removed ? { ok: true, message: "Accès beta retiré." } : { ok: false, error: "Accès déjà retiré." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[beta-admin] retrait", error);
    return { ok: false, error: "Le retrait a échoué. Réessaie dans un instant." };
  }
}
