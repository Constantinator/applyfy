"use server";

import { revalidatePath } from "next/cache";

import { changeApplicationStatus, recordFollowUp } from "@/lib/applications";
import { STATUS_LABELS, isApplicationStatus } from "@/lib/types";

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const MAX_MESSAGE_LENGTH = 5000;

function revalidateApplication(id: string) {
  revalidatePath(`/candidatures/${id}`);
  revalidatePath("/dashboard");
}

export async function updateStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");

  if (!id || !isApplicationStatus(status)) {
    return { status: "error", message: "Statut invalide." };
  }

  const result = await changeApplicationStatus(id, status);
  if (!result.ok) return { status: "error", message: result.error };

  revalidateApplication(id);
  return { status: "success", message: `Statut mis à jour : ${STATUS_LABELS[status]}.` };
}

export async function followUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (!id) return { status: "error", message: "Candidature invalide." };
  if (!message) return { status: "error", message: "Le message de relance est vide." };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { status: "error", message: "Le message est trop long (5 000 caractères max)." };
  }

  const result = await recordFollowUp(id, message);
  if (!result.ok) return { status: "error", message: result.error };

  revalidateApplication(id);
  return { status: "success", message: "Relance enregistrée dans l'historique." };
}
