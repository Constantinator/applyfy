import "server-only";

import {
  OfferSourceError,
  SOURCE_PAGE_SIZE,
  type OfferListing,
  type OfferSearch,
  type OfferSearchResult,
} from "@/lib/offer-types";

// Client de l'API Adzuna (agrégateur d'offres d'emploi), marché français.
// Identifiants ADZUNA_APP_ID / ADZUNA_APP_KEY passés en paramètres de chaque requête.
// L'API ne permet pas de relire une offre par son identifiant : on la retrouve en
// relançant la même recherche, dont la réponse est mise en cache quelques minutes.

const API_URL = process.env.ADZUNA_API_URL ?? "https://api.adzuna.com/v1/api/jobs/fr";
/** Durée de cache d'une page de résultats (l'offre choisie doit s'y retrouver à l'ajout). */
const SEARCH_REVALIDATE_SECONDS = 900;

/** Préfixe des identifiants Adzuna dans l'application (?offre=adzuna-123). */
const ID_PREFIX = "adzuna-";

export function isAdzunaConfigured() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export class AdzunaError extends OfferSourceError {}

export function isAdzunaOfferId(id: unknown): id is string {
  return typeof id === "string" && new RegExp(`^${ID_PREFIX}[A-Za-z0-9]{1,30}$`).test(id);
}

type RawJob = {
  id: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string; tag?: string };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Texte brut : Adzuna renvoie parfois des balises (<strong>) et des entités HTML. */
function plain(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (match, name: string) =>
      name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? match),
    )
    .replace(/\s+/g, " ")
    .trim();
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Salaire annoncé par l'employeur ; les estimations d'Adzuna sont ignorées. */
function salary(job: RawJob): string | null {
  if (String(job.salary_is_predicted) === "1") return null;
  const [min, max] = [job.salary_min, job.salary_max].filter((v): v is number => typeof v === "number" && v > 0);
  if (!min) return null;
  return max && Math.round(max) !== Math.round(min)
    ? `${euros.format(min)} – ${euros.format(max)} par an`
    : `${euros.format(min)} par an`;
}

const CONTRACTS: Record<string, string> = { permanent: "CDI", contract: "CDD" };
const WORKING_TIMES: Record<string, string> = { full_time: "Temps plein", part_time: "Temps partiel" };

function toListing(job: RawJob): OfferListing | null {
  const id = String(job.id);
  if (!/^[A-Za-z0-9]{1,30}$/.test(id) || !job.redirect_url?.startsWith("https://")) return null;
  const category = plain(job.category?.label);
  const description = plain(job.description);
  return {
    id: `${ID_PREFIX}${id}`,
    source: "adzuna",
    title: plain(job.title) || "Offre sans intitulé",
    company: plain(job.company?.display_name) || null,
    location: plain(job.location?.display_name) || null,
    publishedAt: job.created ?? null,
    contract: (job.contract_type && CONTRACTS[job.contract_type]) ?? null,
    url: job.redirect_url,
    description,
    // Adzuna ne fournit qu'un extrait (≈ 500 caractères), le plus souvent terminé par « … ».
    descriptionTruncated: description.length > 0,
    salary: salary(job),
    workingHours: (job.contract_time && WORKING_TIMES[job.contract_time]) ?? null,
    experience: null,
    // Catégorie « fourre-tout » d'Adzuna : sans intérêt pour l'utilisateur.
    sector: category && job.category?.tag !== "unknown" ? category : null,
    companyDescription: null,
    profile: { experience: null, formations: [], skills: [], qualities: [], languages: [], licences: [] },
  };
}

export async function searchAdzuna(search: OfferSearch): Promise<OfferSearchResult> {
  // Les secteurs sont des codes France Travail, sans équivalent chez Adzuna : avec ce
  // filtre, seules les offres France Travail sont pertinentes.
  if (search.sector) return { offers: [], total: 0 };

  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID ?? "",
    app_key: process.env.ADZUNA_APP_KEY ?? "",
    results_per_page: String(SOURCE_PAGE_SIZE),
    sort_by: search.keywords ? "relevance" : "date",
  });
  let keywords = search.keywords;
  if (search.contract === "cdi") params.set("permanent", "1");
  else if (search.contract === "cdd") params.set("contract", "1");
  // Pas de filtre alternance ou stage chez Adzuna : mot-clé.
  else if (search.contract) keywords = `${keywords} ${search.contract}`.trim();
  if (keywords) params.set("what", keywords);
  if (search.department) params.set("where", search.department.name);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/search/${search.page}?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: SEARCH_REVALIDATE_SECONDS },
    });
  } catch (error) {
    console.error("[adzuna] recherche", error);
    throw new AdzunaError("Le service d'Adzuna ne répond pas. Réessaie dans un instant.");
  }
  if (!response.ok) {
    console.error("[adzuna] recherche", response.status, await response.text().catch(() => ""));
    throw new AdzunaError(
      response.status === 429
        ? "Trop de recherches en ce moment. Réessaie dans quelques secondes."
        : response.status === 401 || response.status === 403
          ? "Connexion à Adzuna impossible (identifiants refusés)."
          : "Le service d'Adzuna ne répond pas. Réessaie dans un instant.",
    );
  }

  const data = (await response.json()) as { results?: RawJob[]; count?: number };
  const offers = (data.results ?? []).map(toListing).filter((offer): offer is OfferListing => offer !== null);
  return { offers, total: data.count ?? offers.length };
}

/** Une offre Adzuna, retrouvée dans les résultats (en cache) de la recherche où elle a été vue. */
export async function findAdzunaOffer(id: string, search: OfferSearch): Promise<OfferListing | null> {
  if (!isAdzunaOfferId(id)) return null;
  const { offers } = await searchAdzuna(search);
  return offers.find((offer) => offer.id === id) ?? null;
}
