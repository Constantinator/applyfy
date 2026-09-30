"use server";

import Anthropic from "@anthropic-ai/sdk";

import { requireUser } from "@/lib/auth";
import { isClaudeConfigured, summarizeOffer, type OfferSummary } from "@/lib/claude";
import { OfferImportError, importOfferFromUrl, type ImportedOffer } from "@/lib/offer-import";
import { OFFER_DESCRIPTION_MAX_LENGTH, SUMMARY_MIN_LENGTH } from "@/lib/offer-limits";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Ces actions déclenchent des requêtes sortantes et des appels payants à l'API Claude :
// réservées aux utilisateurs connectés (hors mode démo local).
async function ensureAllowed() {
  if (isSupabaseConfigured()) await requireUser();
}

export type ImportOfferResult =
  | { ok: true; offer: ImportedOffer }
  | { ok: false; error: string };

export async function importOfferAction(url: string): Promise<ImportOfferResult> {
  await ensureAllowed();
  if (typeof url !== "string" || url.length > 2000) {
    return { ok: false, error: "Lien invalide." };
  }

  try {
    return { ok: true, offer: await importOfferFromUrl(url.trim()) };
  } catch (error) {
    if (error instanceof OfferImportError) return { ok: false, error: error.message };
    console.error("[importOffer]", error);
    return { ok: false, error: "Impossible de lire cette page." };
  }
}

export type SummarizeResult = { ok: true; summary: string } | { ok: false; error: string };

function formatSummary({ missions, profil, avantages }: OfferSummary) {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((item) => `• ${item}`).join("\n")}` : "";
  return [
    section("Missions", missions),
    section("Profil recherché", profil),
    section("Avantages", avantages),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function summarizeOfferAction(description: string): Promise<SummarizeResult> {
  await ensureAllowed();
  if (!isClaudeConfigured()) {
    return { ok: false, error: "Le résumé automatique n'est pas activé (clé API Claude manquante)." };
  }

  const text = typeof description === "string" ? description.trim() : "";
  if (text.length < SUMMARY_MIN_LENGTH) {
    return { ok: false, error: "Colle la description complète de l'offre pour générer un résumé." };
  }
  if (text.length > OFFER_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "Description trop longue (20 000 caractères max)." };
  }

  try {
    const summary = await summarizeOffer(text);
    if (!summary) return { ok: false, error: "Le résumé n'a pas pu être généré pour cette offre." };
    return { ok: true, summary: formatSummary(summary) };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Trop de demandes en ce moment. Réessaie dans une minute." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[summarizeOffer] clé API Claude invalide");
      return { ok: false, error: "Le résumé automatique est momentanément indisponible." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[summarizeOffer] API ${error.status}`, error.message);
      return { ok: false, error: "Le service de résumé est indisponible. Réessaie plus tard." };
    }
    console.error("[summarizeOffer]", error);
    return { ok: false, error: "Le résumé n'a pas pu être généré." };
  }
}
