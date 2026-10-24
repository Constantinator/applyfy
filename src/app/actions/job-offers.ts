"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
import { PREMIUM_ONLY_MESSAGE } from "@/lib/ai-usage-limits";
import { createApplication } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { isClaudeConfigured, summarizeJobOffer } from "@/lib/claude";
import { normalizeCompanyName } from "@/lib/normalize";
import { OFFER_DESCRIPTION_MAX_LENGTH } from "@/lib/offer-limits";
import { OfferSourceError } from "@/lib/offer-types";
import { getOfferForApplication, isOfferSearchConfigured, readOfferQuery, resolveOfferSearch } from "@/lib/offers";
import { isPremium } from "@/lib/subscription";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type AddOfferState = { status: "idle" } | { status: "error"; message: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Crée une candidature (brouillon) à partir d'une offre (France Travail, Adzuna ou page carrières), puis
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
      // Seul un vrai nom est normalisé (pas le texte de remplacement).
      company: clip(offer.company ? normalizeCompanyName(offer.company) : "Entreprise non communiquée", 120),
      position: clip(offer.title, 160),
      location: offer.location ? clip(offer.location, 120) : null,
      offer_url: offer.url.length <= 2000 ? offer.url : null,
      offer_description: offer.description ? clip(offer.description, OFFER_DESCRIPTION_MAX_LENGTH) : null,
      offer_summary: null,
      offer_description_partial: offer.descriptionPartial,
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

export type JobOfferSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: string; premiumRequired?: boolean };

/**
 * Résumé IA d'une offre de la recherche (réservé au Premium) : poste, entreprise, contrat,
 * localisation, puis points clés et compétences requises. L'offre est relue côté serveur.
 */
export async function summarizeJobOfferAction(offerId: string, search: string): Promise<JobOfferSummaryResult> {
  if (isSupabaseConfigured()) await requireUser();
  if (!isClaudeConfigured()) {
    return { ok: false, error: "Le résumé automatique n'est pas activé (clé API Claude manquante)." };
  }
  if (!(await isPremium())) return { ok: false, error: PREMIUM_ONLY_MESSAGE, premiumRequired: true };

  // Limites quotidienne et par minute (le Premium n'a pas de limite mensuelle).
  const gate = await checkAiAccess("resume_offre");
  if (!gate.ok) return { ok: false, error: gate.message };

  try {
    const query = readOfferQuery(Object.fromEntries(new URLSearchParams(typeof search === "string" ? search : "")));
    const { search: offerSearch } = await resolveOfferSearch(query);
    const offer = await getOfferForApplication(String(offerId), offerSearch);
    if (!offer) return { ok: false, error: "Cette offre n'est plus disponible." };

    const summary = await summarizeJobOffer({ ...offer, description: clip(offer.description, OFFER_DESCRIPTION_MAX_LENGTH) });
    if (!summary) return { ok: false, error: "Le résumé n'a pas pu être généré pour cette offre." };
    await recordAiUsage("resume_offre");

    const bullets = (items: string[]) => items.map((item) => `• ${item}`).join("\n");
    const facts = [
      `• Poste : ${offer.title}`,
      `• Entreprise : ${offer.company ?? "Non communiquée"}`,
      `• Type de contrat : ${offer.contract ?? "Non précisé"}`,
      `• Localisation : ${offer.location ?? "Non précisée"}`,
    ].join("\n");
    return {
      ok: true,
      summary: [
        facts,
        summary.points_cles.length ? `## Points clés du poste\n${bullets(summary.points_cles)}` : "",
        summary.competences.length ? `## Compétences requises\n${bullets(summary.competences)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof OfferSourceError) return { ok: false, error: error.message };
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Trop de demandes en ce moment. Réessaie dans une minute." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[summarizeJobOffer] API ${error.status}`, error.message);
      return { ok: false, error: "Le service de résumé est indisponible. Réessaie plus tard." };
    }
    console.error("[summarizeJobOffer]", error);
    return { ok: false, error: "Le résumé n'a pas pu être généré." };
  }
}
