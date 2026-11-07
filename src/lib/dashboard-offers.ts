import "server-only";

import type { Sector } from "./cv-sector-context";
import { offersCutoff, pickOffersForYou, type AppliedOffer, type JobOfferRow, type OfferForYou } from "./offers-for-you";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

/** Offres récentes du secteur examinées pour une recommandation. */
const CANDIDATE_LIMIT = 200;

/**
 * « Offres pour toi » : lecture en base seulement, aucun appel externe. job_offers_raw n'est
 * lisible qu'avec le service_role (migration 0032) ; seules des colonnes sans donnée utilisateur
 * sont lues, et les offres collées par les utilisateurs n'ont pas de lien : elles sont exclues.
 * Sans échec : aucune offre si la lecture est impossible.
 */
export async function getOffersForYou(sector: Sector, targetJob: string, applied: AppliedOffer[]): Promise<OfferForYou[]> {
  if (!isAdminConfigured()) return [];
  const now = new Date();
  try {
    const { data, error } = await createAdminClient()
      .from("job_offers_raw")
      .select("id, title, company, url, scraped_at")
      .eq("sector", sector)
      .not("url", "is", null)
      .gte("scraped_at", offersCutoff(now))
      .order("scraped_at", { ascending: false })
      .limit(CANDIDATE_LIMIT);
    if (error) throw error;
    return pickOffersForYou(data as JobOfferRow[], targetJob, applied, now);
  } catch (error) {
    console.error("[dashboard] lecture des offres", error);
    return [];
  }
}
