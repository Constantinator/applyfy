import "server-only";

import { createHash } from "node:crypto";

import { after } from "next/server";

import { detectSector, matchSectorKeywords } from "./cv-sector-context";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

// Offres collées par les utilisateurs (candidature, adaptation de CV) : versées dans
// job_offers_raw (source « user ») et job_keywords, comme les offres collectées par
// scripts/scrape-jobs.ts. Rien sur l'utilisateur : ni identifiant, ni lien vers sa candidature ;
// les adresses email et numéros de téléphone du texte sont masqués.

/** En dessous : extrait ou texte incomplet, sans intérêt pour les statistiques. */
const MIN_DESCRIPTION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 20_000;

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+33\s?|0)[1-9]([\s.-]?\d{2}){4}/g;

/**
 * Enregistre l'offre après l'envoi de la réponse (`after`) : n'allonge pas l'action et ses
 * erreurs sont seulement journalisées. À appeler depuis une action serveur.
 */
export function recordUserJobOffer(offer: { title: string; company: string | null; description: string }) {
  const description = offer.description.trim();
  if (description.length < MIN_DESCRIPTION_LENGTH || !isAdminConfigured()) return;
  after(async () => {
    try {
      await saveUserJobOffer({ ...offer, description: description.slice(0, MAX_DESCRIPTION_LENGTH) });
    } catch (error) {
      console.error("[user-job-offers] enregistrement impossible", error);
    }
  });
}

async function saveUserJobOffer({ title, company, description }: { title: string; company: string | null; description: string }) {
  const text = description.replace(EMAIL, "[email]").replace(PHONE, "[téléphone]");
  // detectSector lit un CV en JSON ; un texte brut est accepté (repli sur ses mots-clés).
  const sector = detectSector(text, title);
  // Même offre collée par plusieurs utilisateurs : une seule ligne, mots-clés comptés une fois.
  const externalId = createHash("sha256")
    .update(text.toLowerCase().replace(/\s+/g, " "))
    .digest("hex")
    .slice(0, 32);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("job_offers_raw")
    .upsert(
      {
        source: "user",
        external_id: externalId,
        title: title.trim().slice(0, 200) || "Offre sans intitulé",
        company: company?.trim().slice(0, 120) || null,
        sector,
        description: text,
      },
      { onConflict: "source,external_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;
  if (!data?.length) return;

  const keywords = matchSectorKeywords(`${title} ${text}`, sector, [company]);
  if (!keywords.length) return;
  const { error: rpcError } = await supabase.rpc("increment_job_keywords", {
    p_sector: sector,
    p_keywords: keywords,
    p_source: "user",
  });
  if (rpcError) throw rpcError;
}
