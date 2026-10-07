"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { createApplication } from "@/lib/applications";
import { normalizeCompanyName } from "@/lib/normalize";
import { OFFER_DESCRIPTION_MAX_LENGTH } from "@/lib/offer-limits";
import { OfferSourceError } from "@/lib/offer-types";
import { getOfferForApplication, isOfferSearchConfigured, readOfferQuery, resolveOfferSearch } from "@/lib/offers";

export type AddOfferState = { status: "idle" } | { status: "error"; message: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Crée une candidature (brouillon) à partir d'une offre (France Travail ou Adzuna), puis
 * ouvre sa fiche. L'offre est relue côté serveur : seuls son identifiant et la recherche
 * où elle a été vue (nécessaire pour retrouver une offre Adzuna) viennent du navigateur.
 */
export async function addOfferToApplicationsAction(
  _prev: AddOfferState,
  formData: FormData,
): Promise<AddOfferState> {
  if (!isOfferSearchConfigured()) {
    return { status: "error", message: "La recherche d'offres n'est pas configurée." };
  }

  let id: string;
  try {
    const query = readOfferQuery(Object.fromEntries(new URLSearchParams(String(formData.get("search") ?? ""))));
    const { search } = await resolveOfferSearch(query);
    const offer = await getOfferForApplication(String(formData.get("offerId") ?? ""), search);
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
    if (error instanceof OfferSourceError) return { status: "error", message: error.message };
    console.error("[addOfferToApplications]", error);
    return { status: "error", message: "L'ajout a échoué. Réessaie dans un instant." };
  }

  revalidatePath("/dashboard");
  redirect(`/candidatures/${id}?creee=1`);
}
