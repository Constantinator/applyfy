"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireAdmin } from "@/lib/admin-metrics";
import { addBetaTesterByEmail, reactivateBetaTester, removeBetaAccess, sendBetaMessage } from "@/lib/beta-admin";
import { betaAddMessage } from "@/lib/beta-rules";

export type BetaAdminResult = { ok: true; message: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
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

/**
 * « Réactiver » : un testeur suspendu ou retiré redevient actif, avec un nouveau calendrier de
 * rapports. L'admin peut dépasser les places.
 */
export async function reactivateBetaTesterAction(userId: string, email: string): Promise<BetaAdminResult> {
  const admin = await requireAdmin();
  if (typeof userId !== "string" || !UUID.test(userId)) return { ok: false, error: "Beta testeur invalide." };
  const label = typeof email === "string" && email ? email : "Ce testeur";
  try {
    const { outcome, activeCount } = await reactivateBetaTester(admin.id, userId);
    // Premium débloqué ou retiré : toutes les pages qui affichent les limites sont rafraîchies.
    revalidatePath("/", "layout");
    const message = betaAddMessage(outcome, label, activeCount);
    return outcome === "reactive" ? { ok: true, message } : { ok: false, error: message };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[beta-admin] réactivation", error);
    return { ok: false, error: "La réactivation a échoué. Réessaie dans un instant." };
  }
}

/** « Ajouter à la beta » : compte existant, retrouvé par son email. Aucun compte n'est créé. */
export async function addBetaTesterAction(email: string): Promise<BetaAdminResult> {
  const admin = await requireAdmin();
  const address = typeof email === "string" ? email.trim() : "";
  if (!address || address.length > EMAIL_MAX_LENGTH || !EMAIL.test(address)) {
    return { ok: false, error: "Saisis l'adresse email d'un compte Applyfy." };
  }
  try {
    const { outcome, activeCount } = await addBetaTesterByEmail(admin.id, address);
    if (outcome === "ajoute" || outcome === "reactive") revalidatePath("/", "layout");
    const message = betaAddMessage(outcome, address, activeCount);
    return outcome === "ajoute" || outcome === "reactive" ? { ok: true, message } : { ok: false, error: message };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[beta-admin] ajout", error);
    return { ok: false, error: "L'ajout a échoué. Réessaie dans un instant." };
  }
}
