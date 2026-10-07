"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  changeApplicationStatus,
  createApplication,
  deleteApplication,
  markApplicationSent,
  recordFollowUp,
  today,
  updateApplicationDetails,
  type ApplicationDetailsPatch,
} from "@/lib/applications";
import { CONTACT_NAME_MAX_LENGTH, EMAIL_PATTERN, NOTES_MAX_LENGTH } from "@/lib/application-details";
import { normalizeCompanyName } from "@/lib/normalize";
import { OFFER_DESCRIPTION_MAX_LENGTH, OFFER_SUMMARY_MAX_LENGTH } from "@/lib/offer-limits";
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

export async function markAsSentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const sentOn = String(formData.get("sent_on") ?? "").trim() || today();

  if (!id) return { status: "error", message: "Candidature invalide." };
  if (!isValidIsoDate(sentOn)) return { status: "error", message: "Date d'envoi invalide." };
  if (sentOn > today()) {
    return { status: "error", message: "La date d'envoi ne peut pas être dans le futur." };
  }

  const result = await markApplicationSent(id, sentOn);
  if (!result.ok) return { status: "error", message: result.error };

  revalidateApplication(id);
  return { status: "success", message: "✓ Candidature marquée comme envoyée." };
}

export type SaveDetailsResult = { ok: true; savedAt: string } | { ok: false; error: string };

async function saveDetails(id: unknown, patch: ApplicationDetailsPatch, context: string): Promise<SaveDetailsResult> {
  if (typeof id !== "string" || !id) return { ok: false, error: "Candidature invalide." };
  try {
    const result = await updateApplicationDetails(id, patch);
    if (!result.ok) return result;
  } catch (error) {
    unstable_rethrow(error); // laisse passer la redirection vers /login de requireUser()
    console.error(`[${context}]`, error);
    return { ok: false, error: "L'enregistrement a échoué. Réessaie dans un instant." };
  }
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Notes libres de la fiche (enregistrement automatique). */
export async function saveNotesAction(id: string, notes: string): Promise<SaveDetailsResult> {
  if (typeof notes !== "string") return { ok: false, error: "Requête invalide." };
  if (notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: "Notes trop longues (10 000 caractères max) : elles ne sont plus enregistrées." };
  }
  // Pas de revalidation : la zone de texte garde son propre état, inutile de recharger la fiche.
  return saveDetails(id, { notes: notes.trim() ? notes : null }, "saveNotes");
}

/** Longueur minimale d'une description collée à la main (en dessous : sans doute incomplète). */
const PASTED_DESCRIPTION_MIN_LENGTH = 100;

/**
 * Description complète collée par l'utilisateur, à la place d'un extrait (offre Adzuna ou
 * France Travail dont le site d'origine bloque la lecture). Retire la mention « partielle ».
 */
export async function completeOfferDescriptionAction(id: string, description: string): Promise<SaveDetailsResult> {
  if (typeof description !== "string") return { ok: false, error: "Requête invalide." };
  const text = description
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < PASTED_DESCRIPTION_MIN_LENGTH) {
    return { ok: false, error: "Colle la description complète de l'offre (missions, profil recherché…)." };
  }
  if (text.length > OFFER_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "Description trop longue (20 000 caractères max)." };
  }

  const result = await saveDetails(
    id,
    { offer_description: text, offer_description_partial: false },
    "completeOfferDescription",
  );
  if (result.ok) revalidateApplication(id);
  return result;
}

/** Nom et email du contact (recruteur, RH…), modifiés directement sur la fiche. */
export async function updateContactAction(
  id: string,
  contact: { name: string; email: string },
): Promise<SaveDetailsResult> {
  const name = typeof contact?.name === "string" ? contact.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof contact?.email === "string" ? contact.email.trim().toLowerCase() : "";
  if (name.length > CONTACT_NAME_MAX_LENGTH) return { ok: false, error: "Nom trop long." };
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return { ok: false, error: "Adresse email invalide." };
  }

  const result = await saveDetails(
    id,
    { contact_name: name || null, contact_email: email || null },
    "updateContact",
  );
  // Le contact sert aussi au message et à l'email de relance : la fiche est rafraîchie.
  if (result.ok) revalidateApplication(id);
  return result;
}

export async function deleteApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Candidature invalide." };

  try {
    const result = await deleteApplication(id);
    if (!result.ok) return { status: "error", message: result.error };
  } catch (error) {
    unstable_rethrow(error); // laisse passer la redirection vers /login de requireUser()
    console.error("[deleteApplication]", error);
    return { status: "error", message: "La suppression a échoué. Réessaie dans un instant." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?suppression=ok");
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export type NewApplicationField =
  | "company"
  | "position"
  | "location"
  | "offer_url"
  | "offer_description"
  | "offer_summary";

export type NewApplicationState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<NewApplicationField, string>>;
  /** Valeurs soumises, pour ré-afficher le formulaire en cas d'erreur. */
  values?: Partial<Record<NewApplicationField, string>>;
};

const LIMITS = {
  company: 120,
  position: 160,
  location: 120,
  offer_url: 2000,
  offer_description: OFFER_DESCRIPTION_MAX_LENGTH,
  offer_summary: OFFER_SUMMARY_MAX_LENGTH,
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createApplicationAction(
  _prev: NewApplicationState,
  formData: FormData,
): Promise<NewApplicationState> {
  const text = (name: NewApplicationField) => String(formData.get(name) ?? "").trim();
  const values = {
    company: normalizeCompanyName(text("company")),
    position: text("position"),
    location: text("location"),
    offer_url: text("offer_url"),
    offer_description: text("offer_description"),
    offer_summary: text("offer_summary"),
  };

  const fieldErrors: NewApplicationState["fieldErrors"] = {};

  if (!values.company) fieldErrors.company = "Indique le nom de l'entreprise.";
  else if (values.company.length > LIMITS.company) fieldErrors.company = "Nom trop long.";

  if (!values.position) fieldErrors.position = "Indique le poste visé.";
  else if (values.position.length > LIMITS.position) fieldErrors.position = "Intitulé trop long.";

  if (values.location.length > LIMITS.location) fieldErrors.location = "Localisation trop longue.";

  if (values.offer_url && (values.offer_url.length > LIMITS.offer_url || !isHttpUrl(values.offer_url))) {
    fieldErrors.offer_url = "Le lien doit commencer par http:// ou https://";
  }
  if (values.offer_description.length > LIMITS.offer_description) {
    fieldErrors.offer_description = "Texte trop long (20 000 caractères max).";
  }
  if (values.offer_summary.length > LIMITS.offer_summary) {
    fieldErrors.offer_summary = "Résumé trop long (4 000 caractères max).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Corrige les champs indiqués.", fieldErrors, values };
  }

  // Toujours créée en brouillon : le statut se change ensuite depuis la fiche.
  let id: string;
  try {
    id = await createApplication({
      company: values.company,
      position: values.position,
      location: values.location || null,
      offer_url: values.offer_url || null,
      offer_description: values.offer_description || null,
      offer_summary: values.offer_summary || null,
    });
  } catch (error) {
    unstable_rethrow(error); // laisse passer la redirection vers /login de requireUser()
    console.error("[createApplication]", error);
    return {
      status: "error",
      message: "L'enregistrement a échoué. Réessaie dans un instant.",
      values,
    };
  }

  revalidatePath("/dashboard");
  redirect(`/candidatures/${id}?creee=1`);
}