import "server-only";

import { findAdzunaOffer, isAdzunaConfigured, isAdzunaOfferId, searchAdzuna } from "@/lib/adzuna";
import {
  getFranceTravailOffer,
  isFranceTravailConfigured,
  isFranceTravailOfferId,
  searchFranceTravail,
} from "@/lib/france-travail";
import { resolveDepartment, type Department } from "@/lib/geo";
import { fetchOfferDescription } from "@/lib/offer-import";
import {
  MAX_PAGES,
  MAX_RESULTS_PER_SOURCE,
  OFFER_SOURCES,
  OfferSourceError,
  SOURCE_PAGE_SIZE,
  isContractFilter,
  type ContractFilter,
  type OfferListing,
  type OfferSearch,
  type OfferSource,
} from "@/lib/offer-types";

// Recherche d'offres sur toutes les sources configurées (France Travail, Adzuna) :
// interrogées en parallèle, résultats mélangés.

export function isOfferSearchConfigured() {
  return isFranceTravailConfigured() || isAdzunaConfigured();
}

export function isOfferId(id: unknown): id is string {
  return isFranceTravailOfferId(id) || isAdzunaOfferId(id);
}

// ---------------------------------------------------------------------------
// Paramètres de recherche (URL de la page, formulaire d'ajout)
// ---------------------------------------------------------------------------

export type OfferQuery = {
  keywords: string;
  place: string;
  contract: ContractFilter | null;
  sector: string | null;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined, max = 120) =>
  (typeof value === "string" ? value : "").trim().slice(0, max);

export function readOfferQuery(params: Params): OfferQuery {
  const sector = text(params.secteur);
  return {
    keywords: text(params.q),
    place: text(params.lieu, 80),
    contract: isContractFilter(params.contrat) ? params.contrat : null,
    sector: /^[A-Za-z0-9]{1,6}$/.test(sector) ? sector : null,
    page: Math.max(1, Math.min(Number.parseInt(text(params.page), 10) || 1, MAX_PAGES)),
  };
}

/** Paramètres d'URL d'une recherche (inverse de readOfferQuery). */
export function offerQueryParams(query: OfferQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.keywords) params.set("q", query.keywords);
  if (query.place) params.set("lieu", query.place);
  if (query.contract) params.set("contrat", query.contract);
  if (query.sector) params.set("secteur", query.sector);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export const hasOfferQuery = (query: OfferQuery) =>
  Boolean(query.keywords || query.place || query.contract || query.sector);

/** Recherche prête à lancer ; `department` null si la localisation est introuvable. */
export async function resolveOfferSearch(
  query: OfferQuery,
): Promise<{ search: OfferSearch; department: Department | null } | { search: null; department: null }> {
  const department = query.place ? await resolveDepartment(query.place) : null;
  if (query.place && !department) return { search: null, department: null };
  return {
    department,
    search: {
      keywords: query.keywords,
      department: department && { code: department.code, name: department.departmentName },
      contract: query.contract,
      sector: query.sector,
      page: query.page,
    },
  };
}

// ---------------------------------------------------------------------------
// Recherche combinée
// ---------------------------------------------------------------------------

export type CombinedSearchResult = {
  offers: OfferListing[];
  /** Total des offres trouvées, toutes sources confondues. */
  total: number;
  pageCount: number;
  /** Une source au moins a plus de résultats que ceux consultables. */
  truncated: boolean;
  /** Source en panne alors que l'autre a répondu. */
  warning: string | null;
};

/** Même intitulé chez le même employeur : Adzuna reprend parfois des offres France Travail. */
const duplicateKey = (offer: OfferListing) =>
  `${offer.title}|${offer.company ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9|]/g, "");

export async function searchAllOffers(search: OfferSearch): Promise<CombinedSearchResult> {
  const sources: [OfferSource, typeof searchFranceTravail][] = [];
  if (isFranceTravailConfigured()) sources.push(["france-travail", searchFranceTravail]);
  if (isAdzunaConfigured()) sources.push(["adzuna", searchAdzuna]);

  const settled = await Promise.allSettled(sources.map(([, run]) => run(search)));
  const results = settled.flatMap((outcome) => (outcome.status === "fulfilled" ? [outcome.value] : []));
  const failures = settled.flatMap((outcome, i) =>
    outcome.status === "rejected" ? [{ source: sources[i][0], error: outcome.reason as unknown }] : [],
  );
  for (const { source, error } of failures) {
    if (!(error instanceof OfferSourceError)) console.error(`[offres] recherche ${source}`, error);
  }
  if (results.length === 0) {
    const error = failures[0]?.error;
    throw error instanceof OfferSourceError ? error : new OfferSourceError("La recherche a échoué. Réessaie dans un instant.");
  }

  // Mélange : une offre de chaque source à tour de rôle, sans doublons.
  const seen = new Set<string>();
  const offers: OfferListing[] = [];
  for (let i = 0; i < SOURCE_PAGE_SIZE; i++) {
    for (const result of results) {
      const offer = result.offers[i];
      if (!offer || seen.has(duplicateKey(offer))) continue;
      seen.add(duplicateKey(offer));
      offers.push(offer);
    }
  }

  const reachable = Math.max(...results.map((r) => Math.min(r.total, MAX_RESULTS_PER_SOURCE)));
  return {
    offers,
    total: results.reduce((sum, r) => sum + r.total, 0),
    pageCount: Math.ceil(reachable / SOURCE_PAGE_SIZE),
    truncated: results.some((r) => r.total > MAX_RESULTS_PER_SOURCE),
    warning: failures.length
      ? `Les offres ${failures.map((f) => OFFER_SOURCES[f.source]).join(" et ")} sont momentanément indisponibles.`
      : null,
  };
}

// ---------------------------------------------------------------------------
// Détail d'une offre (panneau de détails, création de la candidature)
// ---------------------------------------------------------------------------

/**
 * Une offre par son identifiant ; null si elle n'existe plus. Une offre Adzuna ne se
 * retrouve que dans la recherche où elle a été vue (`search`).
 */
export async function findOffer(id: string, search: OfferSearch | null): Promise<OfferListing | null> {
  if (isFranceTravailOfferId(id)) return isFranceTravailConfigured() ? getFranceTravailOffer(id) : null;
  if (isAdzunaOfferId(id) && search && isAdzunaConfigured()) return findAdzunaOffer(id, search);
  return null;
}

/**
 * Description complète d'une offre dont on n'a qu'un extrait, lue sur l'offre d'origine ;
 * null si elle n'est pas plus longue que l'extrait (page bloquée, sans données…).
 */
async function fullDescription(offer: OfferListing): Promise<string | null> {
  const full = await fetchOfferDescription(offer.url);
  const excerpt = offer.description.replace(/(\.\.\.|…)$/, "").trim();
  return full && full.length > excerpt.length + 50 ? full : null;
}

/**
 * Offre au format d'une candidature : description + informations clés (lib/format-offer).
 * Un extrait (Adzuna, France Travail incomplet) est remplacé si possible par la description
 * de l'offre d'origine ; sinon il est gardé et `descriptionPartial` vaut true.
 */
export async function getOfferForApplication(id: string, search: OfferSearch | null) {
  const found = await findOffer(id, search);
  if (!found) return null;

  const full = found.descriptionTruncated ? await fullDescription(found) : null;
  const offer = full ? { ...found, description: full } : found;
  const descriptionPartial = found.descriptionTruncated && !full;

  const details = [
    offer.contract && `• Contrat : ${offer.contract}`,
    offer.workingHours && `• Durée du travail : ${offer.workingHours}`,
    offer.salary && `• Salaire : ${offer.salary}`,
    offer.experience && `• Expérience : ${offer.experience}`,
    offer.sector && `• Secteur : ${offer.sector}`,
  ].filter(Boolean);
  const description = [
    offer.description,
    details.length ? `## Informations clés\n${details.join("\n")}` : null,
    offer.companyDescription ? `## L'entreprise\n${offer.companyDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { ...offer, description, descriptionPartial };
}
