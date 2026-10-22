"use server";

import Anthropic from "@anthropic-ai/sdk";
import { refresh } from "next/cache";

import { checkAiAccess, recordAiUsage } from "@/lib/ai-usage";
import { requireUser } from "@/lib/auth";
import { isClaudeConfigured, summarizeOffer, type OfferSummary } from "@/lib/claude";
import {
  OfferImportError,
  importOfferFromPage,
  importOfferFromText,
  importOfferFromUrl,
  type ImportedOffer,
  type OfferImportErrorKind,
  type OpenTabPage,
} from "@/lib/offer-import";
import {
  OFFER_DESCRIPTION_MAX_LENGTH,
  OFFER_PASTED_TEXT_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
} from "@/lib/offer-limits";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Ces actions déclenchent des requêtes sortantes et des appels payants à l'API Claude :
// réservées aux utilisateurs connectés (hors mode démo local).
async function ensureAllowed() {
  if (isSupabaseConfigured()) await requireUser();
}

export type ImportOfferResult =
  | { ok: true; offer: ImportedOffer }
  | { ok: false; error: string; kind: OfferImportErrorKind };

function importFailure(error: unknown, context: string): ImportOfferResult {
  if (error instanceof OfferImportError) return { ok: false, error: error.message, kind: error.kind };
  console.error(`[${context}]`, error);
  return { ok: false, error: "Impossible de lire cette offre.", kind: "failed" };
}

export async function importOfferAction(url: string): Promise<ImportOfferResult> {
  await ensureAllowed();
  if (typeof url !== "string" || url.length > 2000) {
    return { ok: false, error: "Lien invalide.", kind: "failed" };
  }

  try {
    return { ok: true, offer: await importOfferFromUrl(url.trim()) };
  } catch (error) {
    return importFailure(error, "importOffer");
  }
}

/** Repli quand le lien n'a pas pu être lu : l'utilisateur colle le texte de l'offre. */
export async function importOfferFromTextAction(text: string): Promise<ImportOfferResult> {
  await ensureAllowed();
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed.length < SUMMARY_MIN_LENGTH) {
    return { ok: false, error: "Colle le texte complet de l'offre.", kind: "failed" };
  }
  if (trimmed.length > OFFER_PASTED_TEXT_MAX_LENGTH) {
    return { ok: false, error: "Texte trop long (40 000 caractères max).", kind: "failed" };
  }

  try {
    return { ok: true, offer: await importOfferFromText(trimmed) };
  } catch (error) {
    return importFailure(error, "importOfferFromText");
  }
}

/** Page lue par l'extension navigateur dans l'onglet de l'offre (données venant du client : revalidées). */
export async function importOfferFromPageAction(page: OpenTabPage): Promise<ImportOfferResult> {
  await ensureAllowed();
  const invalid: ImportOfferResult = { ok: false, error: "Page illisible.", kind: "failed" };
  if (!page || typeof page !== "object") return invalid;

  const { url, title, text, jsonLd } = page;
  if (typeof url !== "string" || url.length > 2000 || !/^https?:\/\//i.test(url)) return invalid;
  if (typeof title !== "string" || title.length > 500) return invalid;
  if (typeof text !== "string" || text.length > OFFER_PASTED_TEXT_MAX_LENGTH) return invalid;
  if (
    !Array.isArray(jsonLd) ||
    jsonLd.length > 3 ||
    jsonLd.some((block) => typeof block !== "string" || block.length > 50_000)
  ) {
    return invalid;
  }
  if (text.trim().length < SUMMARY_MIN_LENGTH && jsonLd.length === 0) {
    return { ok: false, error: "Aucune information d'offre trouvée sur cette page.", kind: "failed" };
  }

  try {
    return { ok: true, offer: await importOfferFromPage({ url, title, text, jsonLd }) };
  } catch (error) {
    return importFailure(error, "importOfferFromPage");
  }
}

export type SummarizeResult =
  | { ok: true; summary: string }
  | { ok: false; error: string; limitReached?: boolean };

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

  const gate = await checkAiAccess("resume_offre");
  if (!gate.ok) return { ok: false, error: gate.message, limitReached: gate.limitReached };

  try {
    const summary = await summarizeOffer(text);
    if (!summary) return { ok: false, error: "Le résumé n'a pas pu être généré pour cette offre." };
    await recordAiUsage("resume_offre");
    refresh(); // compteur à jour dans la page
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
