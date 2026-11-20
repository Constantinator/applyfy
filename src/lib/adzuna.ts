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

const SECRETS = () => [process.env.ADZUNA_APP_ID, process.env.ADZUNA_APP_KEY];

/** En-têtes qui identifient une requête chez le fournisseur (support). */
const REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "request-id", "x-amzn-requestid", "x-amz-cf-id", "cf-ray"];

/** Réponse JSON annoncée par son type de contenu. */
const isJson = (response: Response) => /json/i.test(response.headers.get("content-type") ?? "");

/** Texte sans aucun secret : valeurs des variables d'environnement et paramètres sensibles masqués. */
function scrub(text: string, secrets: (string | null | undefined)[]): string {
  let clean = text;
  for (const secret of secrets) if (secret && secret.length >= 4) clean = clean.split(secret).join("[masqué]");
  return clean
    .replace(/((?:client_id|client_secret|access_token|app_id|app_key|token)["'=:\s]+)[^&\s"',}<]+/gi, "$1[masqué]")
    .replace(/(Bearer\s+)[^\s"',}<]+/gi, "$1[masqué]");
}

/**
 * UNE ligne de journal par échec : source et étape, statut, type de contenu, serveur, identifiant
 * de requête, 200 premiers caractères du corps (lu normalement avec text()). Jamais d'adresse ni
 * de secret. Sans nouvel essai.
 */
async function logFailure(step: string, response: Response | null, error?: unknown) {
  const secrets = SECRETS();
  if (!response) {
    const code = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
    const reason = error instanceof Error ? `${error.name}${code ? ` ${code}` : ""}` : "inconnue";
    console.error(`[adzuna] échec ${step} : réseau (${scrub(reason, secrets)})`);
    return;
  }
  const requestId = REQUEST_ID_HEADERS.map((name) => response.headers.get(name)).find(Boolean) ?? "-";
  const body = response.bodyUsed ? "" : await response.text().catch(() => "");
  console.error(
    `[adzuna] échec ${step} : statut=${response.status} type=${response.headers.get("content-type") ?? "-"} ` +
      `server=${response.headers.get("server") ?? "-"} requête=${scrub(requestId, secrets)} ` +
      `corps="${scrub(body.replace(/\s+/g, " ").trim().slice(0, 200), secrets)}"`,
  );
}

export async function searchAdzuna(search: OfferSearch): Promise<OfferSearchResult> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID ?? "",
    app_key: process.env.ADZUNA_APP_KEY ?? "",
    results_per_page: String(SOURCE_PAGE_SIZE),
    sort_by: search.sort === "pertinence" ? "relevance" : "date",
    sort_dir: search.sort === "ancien" ? "up" : "down",
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
    await logFailure("recherche", null, error);
    throw new AdzunaError("Le service d'Adzuna ne répond pas. Réessaie dans un instant.");
  }
  if (response.ok && !isJson(response)) {
    // Page HTML (erreur nginx…) ou autre réponse que l'API : réponse inattendue.
    await logFailure("recherche", response);
    throw new AdzunaError("Réponse inattendue d'Adzuna. Réessaie dans un instant.");
  }
  if (!response.ok) {
    await logFailure("recherche", response);
    throw new AdzunaError(
      !isJson(response)
        ? "Réponse inattendue d'Adzuna. Réessaie dans un instant."
        : response.status === 429
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
