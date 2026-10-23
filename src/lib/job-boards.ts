import "server-only";

import { unstable_cache } from "next/cache";

import { decodeEntities, formatOfferDescription } from "@/lib/format-offer";
import { getDepartmentCommunes } from "@/lib/geo";
import { compareOffers, keywordGroups, normalize } from "@/lib/offer-sort";
import {
  SOURCE_PAGE_SIZE,
  type OfferListing,
  type OfferSearch,
  type OfferSearchResult,
} from "@/lib/offer-types";

// Offres publiées directement par des entreprises tech sur leur ATS (Greenhouse, Lever,
// Ashby), via les API publiques de leurs pages carrières (sans clé). Les listes complètes
// sont lues au plus une fois par heure ; la description d'une offre n'est lue qu'à
// l'ouverture de ses détails (les listes avec descriptions pèsent jusqu'à 5 Mo).

export type Ats = "greenhouse" | "lever" | "ashby";

type Company = {
  /** Identifiant dans l'application (lettres minuscules et chiffres). */
  key: string;
  name: string;
  /** Domaine du site, pour le logo. */
  domain: string;
  ats: Ats;
  /** Identifiant de la page carrières chez l'ATS. */
  slug: string;
};

// Slugs vérifiés le 23/10/2026 sur les API des trois ATS. Les autres entreprises
// envisagées (Lydia, Yousign, Hyperline, PayFit, Notion, Spotify, Hugging Face…) n'ont
// pas de page carrières sur l'un d'eux ; Lunchr est l'ancien nom de Swile. Les boards
// Ashby « shift » et « swan » sont des homonymes (fintech australienne, société
// américaine), pas Shift Technology ni Swan.
export const JOB_BOARD_COMPANIES: Company[] = [
  { key: "doctolib", name: "Doctolib", domain: "doctolib.fr", ats: "greenhouse", slug: "doctolib" },
  { key: "mirakl", name: "Mirakl", domain: "mirakl.com", ats: "greenhouse", slug: "mirakl" },
  { key: "ivalua", name: "Ivalua", domain: "ivalua.com", ats: "greenhouse", slug: "ivalua" },
  { key: "dataiku", name: "Dataiku", domain: "dataiku.com", ats: "greenhouse", slug: "dataiku" },
  { key: "datadog", name: "Datadog", domain: "datadoghq.com", ats: "greenhouse", slug: "datadog" },
  { key: "databricks", name: "Databricks", domain: "databricks.com", ats: "greenhouse", slug: "databricks" },
  { key: "stripe", name: "Stripe", domain: "stripe.com", ats: "greenhouse", slug: "stripe" },
  { key: "airbnb", name: "Airbnb", domain: "airbnb.com", ats: "greenhouse", slug: "airbnb" },
  { key: "figma", name: "Figma", domain: "figma.com", ats: "greenhouse", slug: "figma" },
  { key: "gitlab", name: "GitLab", domain: "gitlab.com", ats: "greenhouse", slug: "gitlab" },
  { key: "mongodb", name: "MongoDB", domain: "mongodb.com", ats: "greenhouse", slug: "mongodb" },
  { key: "elastic", name: "Elastic", domain: "elastic.co", ats: "greenhouse", slug: "elastic" },
  { key: "fastly", name: "Fastly", domain: "fastly.com", ats: "greenhouse", slug: "fastly" },
  { key: "cloudflare", name: "Cloudflare", domain: "cloudflare.com", ats: "greenhouse", slug: "cloudflare" },
  { key: "intercom", name: "Intercom", domain: "intercom.com", ats: "greenhouse", slug: "intercom" },
  { key: "mixpanel", name: "Mixpanel", domain: "mixpanel.com", ats: "greenhouse", slug: "mixpanel" },
  { key: "netlify", name: "Netlify", domain: "netlify.com", ats: "greenhouse", slug: "netlify" },
  { key: "pagerduty", name: "PagerDuty", domain: "pagerduty.com", ats: "greenhouse", slug: "pagerduty" },
  { key: "twilio", name: "Twilio", domain: "twilio.com", ats: "greenhouse", slug: "twilio" },
  { key: "vercel", name: "Vercel", domain: "vercel.com", ats: "greenhouse", slug: "vercel" },
  { key: "swile", name: "Swile", domain: "swile.co", ats: "lever", slug: "swile" },
  { key: "contentsquare", name: "Contentsquare", domain: "contentsquare.com", ats: "lever", slug: "contentsquare" },
  { key: "mistral", name: "Mistral AI", domain: "mistral.ai", ats: "lever", slug: "mistral" },
  { key: "aircall", name: "Aircall", domain: "aircall.io", ats: "lever", slug: "aircall" },
  { key: "ogury", name: "Ogury", domain: "ogury.com", ats: "lever", slug: "ogury" },
  { key: "alan", name: "Alan", domain: "alan.com", ats: "ashby", slug: "alan" },
  { key: "qonto", name: "Qonto", domain: "qonto.com", ats: "ashby", slug: "qonto" },
  { key: "pennylane", name: "Pennylane", domain: "pennylane.com", ats: "ashby", slug: "pennylane" },
  { key: "backmarket", name: "Back Market", domain: "backmarket.com", ats: "ashby", slug: "backmarket" },
  { key: "ledger", name: "Ledger", domain: "ledger.com", ats: "ashby", slug: "ledger" },
  { key: "spendesk", name: "Spendesk", domain: "spendesk.com", ats: "ashby", slug: "spendesk" },
  { key: "dust", name: "Dust", domain: "dust.tt", ats: "ashby", slug: "dust" },
  { key: "photoroom", name: "Photoroom", domain: "photoroom.com", ats: "ashby", slug: "photoroom" },
  { key: "poolside", name: "Poolside", domain: "poolside.ai", ats: "ashby", slug: "poolside" },
  { key: "joko", name: "Joko", domain: "joko.com", ats: "ashby", slug: "joko" },
  { key: "owkin", name: "Owkin", domain: "owkin.com", ats: "ashby", slug: "owkin" },
  { key: "nabla", name: "Nabla", domain: "nabla.com", ats: "ashby", slug: "nabla" },
  { key: "cohere", name: "Cohere", domain: "cohere.com", ats: "ashby", slug: "cohere" },
  { key: "openai", name: "OpenAI", domain: "openai.com", ats: "ashby", slug: "openai" },
  { key: "perplexity", name: "Perplexity", domain: "perplexity.ai", ats: "ashby", slug: "perplexity" },
  { key: "anyscale", name: "Anyscale", domain: "anyscale.com", ats: "ashby", slug: "anyscale" },
  { key: "modal", name: "Modal", domain: "modal.com", ats: "ashby", slug: "modal" },
];

const companyByKey = new Map(JOB_BOARD_COMPANIES.map((company) => [company.key, company]));

const companyByName = new Map(JOB_BOARD_COMPANIES.map((company) => [normalize(company.name), company]));

/** Domaine d'une entreprise connue, d'après son nom (offres France Travail et Adzuna comprises). */
export function findCompanyDomain(name: string | null): string | null {
  return (name && companyByName.get(normalize(name))?.domain) || null;
}

/**
 * Logo d'une entreprise (Logo.dev, successeur de Clearbit Logo) ; null sans clé
 * publique LOGO_DEV_TOKEN. `fallback=404` : pas de logo générique, l'affichage
 * remplace l'image manquante par les initiales.
 */
export function getCompanyLogo(domain: string): string | null {
  const token = process.env.LOGO_DEV_TOKEN;
  if (!token) return null;
  const params = new URLSearchParams({ token, size: "64", format: "png", retina: "true", fallback: "404" });
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params}`;
}

// ---------------------------------------------------------------------------
// Lecture des pages carrières
// ---------------------------------------------------------------------------

export type JobBoardJob = {
  /** « <ats>-<entreprise>-<identifiant de l'offre> » (ex. lever-swile-9601b397-…). */
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  ats: Ats;
  postedAt: string | null;
  /** Offre basée en France (au moins un de ses lieux). */
  inFrance: boolean;
  /** Villes françaises de l'offre. */
  cities: string[];
  /** CDI, CDD, Stage ou Alternance, quand l'offre permet de le savoir. */
  contract: string | null;
  /** Équipe ou service : recherché avec le titre. */
  team: string | null;
};

const TIMEOUT_MS = 20_000;

async function getJson<T>(url: string): Promise<T> {
  // Pas de cache de fetch : la plupart des réponses dépassent sa limite de 2 Mo. Les
  // offres normalisées sont mises en cache par getAllJobs.
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return (await response.json()) as T;
}

const jobId = (company: Company, id: string | number) => `${company.ats}-${company.key}-${id}`;

const JOB_ID = /^(greenhouse|lever|ashby)-([a-z0-9]{1,30})-([A-Za-z0-9-]{1,40})$/;

export function isJobBoardOfferId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const match = JOB_ID.exec(id);
  return Boolean(match && companyByKey.get(match[2])?.ats === match[1]);
}

/** Lieux sans ville précise (« Anywhere in France », « Remote »…). */
const GENERIC_PLACE = /^(france|france metropolitan|remote|anywhere|all france|europe|european union)\b|\bremote\b|^anywhere in/;

/** « Paris, Paris, France » → ville « Paris », pays « France ». */
function parsePlace(text: string, defaultCountry: string | null) {
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  const country =
    parts.length > 1 ? parts[parts.length - 1] : (defaultCountry ?? (/\bfrance\b/i.test(text) ? "France" : null));
  const city = (parts[0] ?? "").replace(/\s+offices?$/i, "");
  return { city: GENERIC_PLACE.test(normalize(city)) ? null : city, country };
}

const isFrance = (country: string | null | undefined) => /^(france|fr)\b/i.test(country?.trim() ?? "");

function franceLocation(cities: string[], remote: boolean) {
  const unique = [...new Set(cities)];
  if (unique.length === 0) return remote ? "Télétravail (France)" : "France";
  return unique.length > 3 ? `${unique.slice(0, 3).join(", ")} + ${unique.length - 3}` : unique.join(", ");
}

const CONTRACT_PATTERNS: [RegExp, string][] = [
  [/\b(alternance|alternant|apprenti|apprentie|apprentissage|apprentice|apprenticeship|work[- ]study)\b/i, "Alternance"],
  [/\b(stage|stagiaire|intern|internship)\b/i, "Stage"],
  [/\b(cdd|fixed[- ]term|temporary)\b/i, "CDD"],
  [/\b(cdi|permanent|unlimited contract|full[- ]time|fulltime)\b/i, "CDI"],
];

/**
 * Type de contrat : alternance ou stage d'après l'intitulé (souvent seul à le dire), sinon
 * le type indiqué par l'ATS.
 */
function contractOf(title: string, type: string | null | undefined) {
  for (const [pattern, contract] of CONTRACT_PATTERNS.slice(0, 2)) if (pattern.test(title)) return contract;
  for (const [pattern, contract] of CONTRACT_PATTERNS) if (type && pattern.test(type)) return contract;
  return null;
}

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  first_published?: string;
  updated_at?: string;
  metadata?: { name: string; value: unknown }[] | null;
  departments?: { name: string }[];
  content?: string;
};

const metadataValue = (job: GreenhouseJob, name: string) => {
  const value = job.metadata?.find((m) => m.name === name)?.value;
  return typeof value === "string" ? value : null;
};

function fromGreenhouse(company: Company, job: GreenhouseJob): JobBoardJob {
  const postingCountry = metadataValue(job, "Job Posting Country");
  const places = (job.location?.name ?? "").split(";").map((place) => parsePlace(place, postingCountry));
  const french = places.filter((place) => isFrance(place.country));
  const cities = french.flatMap((place) => (place.city ? [place.city] : []));
  const inFrance = isFrance(postingCountry) || french.length > 0;
  return {
    id: jobId(company, job.id),
    title: job.title.trim(),
    company: company.name,
    location: inFrance ? franceLocation(cities, false) : job.location?.name?.trim() || null,
    url: job.absolute_url,
    ats: "greenhouse",
    postedAt: job.first_published ?? job.updated_at ?? null,
    inFrance,
    cities,
    contract: contractOf(job.title, metadataValue(job, "Employment Type")),
    team: job.departments?.map((d) => d.name).join(" ") || null,
  };
}

/** Greenhouse : https://developers.greenhouse.io/job-board.html */
export async function fetchGreenhouseJobs(company: Company): Promise<JobBoardJob[]> {
  const data = await getJson<{ jobs?: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}/jobs`,
  );
  return (data.jobs ?? []).map((job) => fromGreenhouse(company, job));
}

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string | null;
  workplaceType?: string;
  categories?: { commitment?: string; location?: string; allLocations?: string[]; team?: string; department?: string };
  description?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
};

function fromLever(company: Company, job: LeverJob): JobBoardJob {
  const inFrance = isFrance(job.country);
  const locations = job.categories?.allLocations?.length
    ? job.categories.allLocations
    : [job.categories?.location ?? ""];
  const cities = inFrance
    ? locations.flatMap((location) => parsePlace(location, "France").city ?? [])
    : [];
  return {
    id: jobId(company, job.id),
    title: job.text.trim(),
    company: company.name,
    location: inFrance ? franceLocation(cities, job.workplaceType === "remote") : locations.join(", ") || null,
    url: job.hostedUrl,
    ats: "lever",
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    inFrance,
    cities,
    contract: contractOf(job.text, job.categories?.commitment),
    team: [job.categories?.department, job.categories?.team].filter(Boolean).join(" ") || null,
  };
}

/** Lever : https://github.com/lever/postings-api */
export async function fetchLeverJobs(company: Company): Promise<JobBoardJob[]> {
  const data = await getJson<LeverJob[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company.slug)}?mode=json`,
  );
  return data.map((job) => fromLever(company, job));
}

type AshbyAddress = { postalAddress?: { addressCountry?: string; addressLocality?: string } };

type AshbyJob = {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  address?: AshbyAddress;
  secondaryLocations?: { location?: string; address?: AshbyAddress }[];
  employmentType?: string;
  workplaceType?: string;
  publishedAt?: string;
  isListed?: boolean;
  department?: string;
  team?: string;
  descriptionHtml?: string;
};

function fromAshby(company: Company, job: AshbyJob): JobBoardJob {
  // Lieu principal et lieux secondaires, chacun avec son pays (adresse, sinon texte du lieu).
  const places = [{ location: job.location, address: job.address }, ...(job.secondaryLocations ?? [])].flatMap(
    ({ location, address }) =>
      (location ?? "")
        .split(";")
        .map((place) => parsePlace(place, address?.postalAddress?.addressCountry ?? null)),
  );
  const french = places.filter((place) => isFrance(place.country));
  const cities = french.flatMap((place) => (place.city ? [place.city] : []));
  const inFrance = french.length > 0;
  // « Contract » : utilisé aussi bien pour des CDI que des missions freelance, ignoré.
  const type = job.employmentType === "Contract" ? null : job.employmentType;
  return {
    id: jobId(company, job.id),
    title: job.title.trim(),
    company: company.name,
    location: inFrance ? franceLocation(cities, job.workplaceType === "Remote") : job.location?.trim() || null,
    url: job.jobUrl,
    ats: "ashby",
    postedAt: job.publishedAt ?? null,
    inFrance,
    cities,
    contract: contractOf(job.title, type),
    team: [job.department, job.team].filter(Boolean).join(" ") || null,
  };
}

async function fetchAshbyBoard(company: Company): Promise<AshbyJob[]> {
  const data = await getJson<{ jobs?: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.slug)}`,
  );
  return (data.jobs ?? []).filter((job) => job.isListed !== false);
}

/** Ashby : https://developers.ashbyhq.com/docs/public-job-posting-api */
export async function fetchAshbyJobs(company: Company): Promise<JobBoardJob[]> {
  return (await fetchAshbyBoard(company)).map((job) => fromAshby(company, job));
}

const FETCHERS: Record<Ats, (company: Company) => Promise<JobBoardJob[]>> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
};

/**
 * Offres de toutes les entreprises, lues en parallèle, les plus récentes d'abord. Une
 * page carrières en panne est ignorée ; erreur si aucune ne répond (rien n'est alors
 * mis en cache).
 */
export async function fetchAllJobs(): Promise<JobBoardJob[]> {
  let failures = 0;
  const lists = await Promise.all(
    JOB_BOARD_COMPANIES.map((company) =>
      FETCHERS[company.ats](company).catch((error) => {
        failures++;
        console.error(`[job-boards] ${company.ats} ${company.slug}`, error);
        return [];
      }),
    ),
  );
  if (failures === JOB_BOARD_COMPANIES.length) throw new Error("Aucune page carrières ne répond.");
  return lists.flat().sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
}

/**
 * Offres basées en France, mises en cache une heure. Seules celles-ci sont gardées : la
 * liste complète (plusieurs milliers d'offres) dépasse la limite de 2 Mo du cache.
 */
export const getAllJobs = unstable_cache(
  async () => (await fetchAllJobs()).filter((job) => job.inFrance),
  ["job-boards-france"],
  { revalidate: 3600 },
);

// ---------------------------------------------------------------------------
// Recherche (page « Trouver une offre »)
// ---------------------------------------------------------------------------

const EMPTY_PROFILE = { experience: null, formations: [], skills: [], qualities: [], languages: [], licences: [] };

function toListing(job: JobBoardJob, description = ""): OfferListing {
  return {
    id: job.id,
    source: "job-boards",
    title: job.title,
    company: job.company,
    location: job.location,
    publishedAt: job.postedAt,
    contract: job.contract,
    url: job.url,
    description,
    descriptionTruncated: false,
    salary: null,
    workingHours: null,
    experience: null,
    sector: null,
    companyDescription: null,
    profile: EMPTY_PROFILE,
  };
}

const CONTRACT_LABELS = { cdi: "CDI", cdd: "CDD", alternance: "Alternance", stage: "Stage" } as const;

/**
 * Offres basées en France qui correspondent à la recherche. Sans description : elle est
 * lue à l'ouverture de l'offre (getJobBoardOffer). Ne lève pas d'erreur : les pages
 * carrières complètent France Travail et Adzuna, leur panne ne bloque pas la recherche.
 */
export async function searchJobBoards(search: OfferSearch): Promise<OfferSearchResult> {
  let jobs: JobBoardJob[];
  try {
    jobs = await getAllJobs();
  } catch (error) {
    console.error("[job-boards] recherche", error);
    return { offers: [], total: 0 };
  }

  const groups = keywordGroups(search.keywords);
  const contract = search.contract && CONTRACT_LABELS[search.contract];
  const communes = search.department
    ? new Set((await getDepartmentCommunes(search.department.code)).map(normalize))
    : null;

  const matches = jobs.filter((job) => {
    if (!job.inFrance) return false;
    if (contract && job.contract !== contract) return false;
    if (communes && !job.cities.some((city) => communes.has(normalize(city)))) return false;
    const text = normalize(`${job.title} ${job.company} ${job.team ?? ""}`);
    return groups.every((matches) => matches(text));
  });

  const offers = matches.map((job) => toListing(job)).sort(compareOffers(search.sort, search.keywords));
  const start = (search.page - 1) * SOURCE_PAGE_SIZE;
  return { offers: offers.slice(start, start + SOURCE_PAGE_SIZE), total: offers.length };
}

// ---------------------------------------------------------------------------
// Détail d'une offre
// ---------------------------------------------------------------------------

function leverDescription(job: LeverJob) {
  const lists = (job.lists ?? []).map((list) => `<h3>${list.text}</h3><ul>${list.content}</ul>`);
  return [job.description ?? "", ...lists, job.additional ?? ""].join("\n");
}

/** Offre et description en HTML, lues sur la page carrières ; null si elle n'existe plus. */
async function fetchJobDetails(id: string): Promise<{ job: JobBoardJob; html: string } | null> {
  const [, ats, key, rawId] = JOB_ID.exec(id) ?? [];
  const company = companyByKey.get(key);
  if (!company || company.ats !== ats) return null;
  const slug = encodeURIComponent(company.slug);

  try {
    if (company.ats === "greenhouse") {
      const job = await getJson<GreenhouseJob>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${rawId}`);
      // Greenhouse encode le HTML de la description en entités (&lt;p&gt;…).
      return { job: fromGreenhouse(company, job), html: decodeEntities(job.content ?? "") };
    }
    if (company.ats === "lever") {
      const job = await getJson<LeverJob>(`https://api.lever.co/v0/postings/${slug}/${rawId}`);
      return { job: fromLever(company, job), html: leverDescription(job) };
    }
    // Ashby n'a pas d'API par offre : la page carrières entière est relue.
    const job = (await fetchAshbyBoard(company)).find((j) => j.id === rawId);
    return job ? { job: fromAshby(company, job), html: job.descriptionHtml ?? "" } : null;
  } catch (error) {
    // Offre retirée : Greenhouse et Lever répondent 404.
    if (error instanceof Error && / HTTP 404$/.test(error.message)) return null;
    throw error;
  }
}

async function loadJobBoardOffer(id: string): Promise<OfferListing | null> {
  const details = await fetchJobDetails(id);
  return details && toListing(details.job, formatOfferDescription(details.html));
}

const getCachedOffer = unstable_cache(loadJobBoardOffer, ["job-boards-offer"], { revalidate: 3600 });

/** Une offre complète (description comprise), mise en cache une heure ; null si elle n'existe plus. */
export async function getJobBoardOffer(id: string): Promise<OfferListing | null> {
  return isJobBoardOfferId(id) ? getCachedOffer(id) : null;
}
