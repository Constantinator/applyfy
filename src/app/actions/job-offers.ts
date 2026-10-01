"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { createApplication } from "@/lib/applications";
import { FranceTravailError, getOffer, isFranceTravailConfigured } from "@/lib/france-travail";
import { normalizeCompanyName } from "@/lib/normalize";
import { OFFER_DESCRIPTION_MAX_LENGTH } from "@/lib/offer-limits";

export type AddOfferState = { status: "idle" } | { status: "error"; message: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Crée une candidature (brouillon) à partir d'une offre France Travail, puis ouvre sa
 * fiche. L'offre est relue côté serveur : seul son identifiant vient du navigateur.
 */
export async function addOfferToApplicationsAction(
  _prev: AddOfferState,
  formData: FormData,
): Promise<AddOfferState> {
  if (!isFranceTravailConfigured()) {
    return { status: "error", message: "La recherche d'offres n'est pas configurée." };
  }

  let id: string;
  try {
    const offer = await getOffer(String(formData.get("offerId") ?? ""));
    if (!offer) return { status: "error", message: "Cette offre n'est plus disponible." };

    id = await createApplication({
      company: clip(normalizeCompanyName(offer.company ?? "Entreprise non communiquée"), 120),
      position: clip(offer.title, 160),
      location: offer.location ? clip(offer.location, 120) : null,
      offer_url: offer.url.length <= 2000 ? offer.url : null,
      offer_description: offer.description ? clip(offer.description, OFFER_DESCRIPTION_MAX_LENGTH) : null,
      offer_summary: null,
    });
  } catch (error) {
    unstable_rethrow(error); // redirection vers /login si la session a expiré
    if (error instanceof FranceTravailError) return { status: "error", message: error.message };
    console.error("[addOfferToApplications]", error);
    return { status: "error", message: "L'ajout a échoué. Réessaie dans un instant." };
  }

  revalidatePath("/dashboard");
  redirect(`/candidatures/${id}?creee=1`);
}
