// Collecte des offres sur les API publiques, sans clé, des pages carrières (Greenhouse, Lever,
// Ashby, SmartRecruiters) des entreprises de career-companies.json. Seules les offres en France
// sont gardées. Partagé entre le cron (app/api/cron/collecte) et scripts/scrape-jobs.ts : pas
// d'import propre à Next.js ici.
//
// career-companies.json : une ligne par entreprise (nom, domaine, plateforme, identifiant,
// secteurs). `products` liste ses produits, exclus des mots-clés comme son nom ; `filterTitles`
// liste les secteurs où seules les offres du métier sont gardées (marque grand public classée en
// marketing : postes marketing seulement). Les entreprises ajoutées vont en fin de fichier : elles
// sont lues après les anciennes dans chaque secteur.
//
// Aucun contournement : un refus d'accès (401, 403, défi anti-robot, page HTML au lieu du JSON)
// retire l'entreprise de la collecte (table job_collect_exclusions, migration 0043) ; un 429 sans
// défi l'arrête pour le passage, et la retire au deuxième passage consécutif.
import type { SupabaseClient } from "@supabase/supabase-js";

import { maskContacts } from "./contact-mask";
import type { Sector } from "./cv-sector-context";
import { cleanLocation } from "./offer-location";

export type AtsPlatform = "greenhouse" | "lever" | "lever-eu" | "ashby" | "smartrecruiters";

/** Une ligne de career-companies.json. */
export type CareerCompany = {
  name: string;
  /** Domaine du site vérifié à la main, pour le logo. */
  domain: string;
  platform: AtsPlatform;
  slug: string;
  /** Secteurs où l'entreprise est collectée. */
  sectors: Sector[];
  /** Secteurs où seules les offres du métier du secteur sont gardées. */
  filterTitles?: Sector[];
  products?: string[];
};

/** Une entreprise vue depuis un secteur (filterTitles résolu pour ce secteur). */
export type AtsCompany = {
  name: string;
  /** Domaine du site vérifié à la main, pour le logo. */
  domain: string;
  platform: AtsPlatform;
  slug: string;
  products?: string[];
  filterTitles?: boolean;
};

/** Entreprises d'un secteur, dans l'ordre du fichier (anciennes avant les nouvelles). */
export function companiesForSector(companies: readonly CareerCompany[], sector: Sector): AtsCompany[] {
  return companies
    .filter((company) => company.sectors.includes(sector))
    .map(({ name, domain, platform, slug, products, filterTitles }) => ({
      name,
      domain,
      platform,
      slug,
      ...(products ? { products } : {}),
      ...(filterTitles?.includes(sector) ? { filterTitles: true } : {}),
    }));
}

/** Identifiant stable d'une entreprise dans job_collect_exclusions : « plateforme:identifiant ». */
export const companyKey = (company: { platform: string; slug: string }) => `${company.platform}:${company.slug}`;

/** Une offre lue sur une source, avant extraction des mots-clés. */
export type RawOffer = {
  externalId: string;
  title: string;
  company: string | null;
  products?: string[];
  description: string;
  url: string;
  location: string | null;
  publishedAt: string | null;
};

/** Offres gardées par entreprise à chaque passage. */
export const ATS_OFFERS_PER_COMPANY = 10;
const ATS_DELAY_MS = 1_000;
const ATS_TIMEOUT_MS = 20_000;
const LOCATION_MAX_LENGTH = 120;
/** Description gardée en base (offres collectées), après masquage des coordonnées. */
export const STORED_DESCRIPTION_MAX_LENGTH = 4_000;

const FRANCE =
  /\bfrance\b|\bparis\b|\blyon\b|marseille|\blille\b|bordeaux|toulouse|nantes|\bnice\b|rennes|strasbourg|montpellier|grenoble|sophia|[iî]le[- ]de[- ]france|la d[ée]fense|boulogne|neuilly|levallois|issy/i;

/**
 * Intitulés du métier de chaque secteur filtré. Toujours appliqué aux secteurs transverses, lus
 * chez des employeurs de tous domaines (stages et alternances ; postes RH) ; ailleurs, seulement
 * pour les entreprises marquées `filterTitles`.
 */
const TITLE_FILTERS: Partial<Record<Sector, RegExp>> = {
  etudiant: /stag|intern|alternan|apprenti|graduate|\bv\.?i\.?e\b|work[- ]study/i,
  rh: /\b(rh|hr|drh|rrh|hrbp)\b|ressources humaines|human resources|people|talent|recrut|recruit|paie|payroll|compensation|formation/i,
  marketing:
    /marketing|brand|marque|communication|growth|\bseo\b|\bsea\b|acquisition|\bcrm\b|content|contenu|social media|community|m[ée]dia|digital|e-?commerce|chef de produit|relations presse|\bpr\b|influence|[ée]v[ée]nementiel|event/i,
  creatif:
    /design|graphi|artist|art director|directeur artistique|direction artistique|motion|vid[ée]o|\b3d\b|animat|illustr|\bux\b|\bui\b|creative|cr[ée]atif|cr[ée]ative|photo|monteu|sound|game designer|level designer|concept|r[ée]alisat|post-production|dubbing|doublage|subtitl|sous-titr|maquett|stylis|mod[ée]lis/i,
};
const ALWAYS_FILTERED = new Set<Sector>(["etudiant", "rh"]);

export function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

export function decodeHtml(text: string) {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Robot identifié, comme pour toutes les requêtes de la collecte. */
export const collectUserAgent = () => `ApplyfyBot/0.1 (+${process.env.APP_URL || "https://applyfy.fr"})`;

export type GetJson = <T>(url: string) => Promise<T | null>;

/**
 * Refus d'accès d'une page carrières. `challenge` : en-tête cf-mitigated (défi anti-robot) ou
 * page HTML à la place du JSON. Tous retirent l'entreprise, sauf http_429 (voir collectSector).
 */
export type BlockReason = "http_401" | "http_403" | "http_429" | "challenge";

export class AtsBlockedError extends Error {
  // Champs déclarés à part : Node (scripts, tests) lit ce fichier sans compilation.
  readonly reason: BlockReason;
  readonly status: number;
  readonly url: string;

  constructor(reason: BlockReason, status: number, url: string) {
    super(`${url} → accès refusé (${reason}, HTTP ${status})`);
    this.name = "AtsBlockedError";
    this.reason = reason;
    this.status = status;
    this.url = url;
  }
}

/**
 * GET JSON avec un délai minimum entre deux requêtes ; null si la réponse n'est pas exploitable
 * (404, panne 5xx, réseau, JSON illisible). Lève AtsBlockedError sur un refus d'accès : 401, 403,
 * 429, en-tête cf-mitigated, ou page HTML reçue à la place du JSON.
 */
export function createAtsClient({
  fetchImpl = fetch,
  delayMs = ATS_DELAY_MS,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  log = console.warn,
}: {
  fetchImpl?: typeof fetch;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
} = {}): GetJson {
  let nextAt = 0;
  return async <T>(url: string) => {
    const wait = nextAt - now();
    if (wait > 0) await sleep(wait);
    nextAt = now() + delayMs;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { "User-Agent": collectUserAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(ATS_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      log(`ats : ${url} → ${error instanceof Error ? error.message : error}`);
      return null;
    }
    const blocked = blockReason(response);
    if (blocked) {
      log(`ats : ${url} → accès refusé (${blocked}, HTTP ${response.status})`);
      throw new AtsBlockedError(blocked, response.status, url);
    }
    if (!response.ok) {
      log(`ats : ${url} → HTTP ${response.status}`);
      return null;
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      log(`ats : ${url} → ${error instanceof Error ? error.message : error}`);
      return null;
    }
  };
}

/** Refus d'accès lisible dans la réponse, ou null. Une panne (5xx) n'en est pas un. */
function blockReason(response: Response): BlockReason | null {
  if (response.headers.get("cf-mitigated")) return "challenge";
  if (response.status === 401) return "http_401";
  if (response.status === 403) return "http_403";
  if (response.status === 429) return "http_429";
  if (response.ok && /text\/html/i.test(response.headers.get("content-type") ?? "")) return "challenge";
  return null;
}

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  first_published?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string | null }[];
};
type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  country?: string;
  createdAt?: number;
  categories?: { location?: string; allLocations?: string[] };
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
};
type AshbyJob = {
  id: string;
  title: string;
  jobUrl: string;
  isListed?: boolean;
  publishedAt?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  address?: { postalAddress?: { addressCountry?: string } };
  descriptionPlain?: string;
};
type SmartRecruitersPosting = {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { country?: string; city?: string };
};
type SmartRecruitersDetail = {
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { text?: string } | undefined> };
};

/** Lieu affiché : villes françaises nettoyées (offer-location.ts), sinon « France » ou « Télétravail (France) ». */
function pickLocation(candidates: (string | null | undefined)[]): string {
  return cleanLocation(candidates.map((value) => decodeHtml(value ?? ""))).label.slice(0, LOCATION_MAX_LENGTH);
}

/** Date ISO, ou null si la source n'en donne pas de valide. */
function toIsoDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type CompanyOffers = {
  offers: RawOffer[];
  /** La liste des offres de l'entreprise n'a pas pu être lue (404, panne…). */
  failed: boolean;
  /** Lecture interrompue par shouldStop : les offres déjà lues restent valables. */
  stopped: boolean;
  /** Accès refusé (failed vaut alors true) : aucune requête de plus vers l'entreprise. */
  blocked?: { reason: BlockReason; status: number; url: string };
};

/** Identifiants (externalId) déjà en base parmi ceux donnés : leur description n'est pas relue. */
export type KnownOffers = (externalIds: string[]) => Promise<Set<string>>;
const NONE_KNOWN: KnownOffers = async () => new Set();

/**
 * Offres en France d'une entreprise (au plus `limit`), avec leur description (lue seulement pour
 * les offres nouvelles quand elle demande une requête de plus). Un refus d'accès arrête aussitôt
 * la lecture : les offres déjà lues restent, `blocked` en donne la raison.
 */
export async function readCompanyOffers(
  company: AtsCompany,
  limit: number,
  keep: (title: string) => boolean,
  get: GetJson,
  shouldStop: () => boolean = () => false,
  known: KnownOffers = NONE_KNOWN,
): Promise<CompanyOffers> {
  const offers: RawOffer[] = [];
  try {
    return await readOffers(company, limit, keep, get, shouldStop, known, offers);
  } catch (error) {
    if (!(error instanceof AtsBlockedError)) throw error;
    return { offers, failed: true, stopped: false, blocked: { reason: error.reason, status: error.status, url: error.url } };
  }
}

async function readOffers(
  company: AtsCompany,
  limit: number,
  keep: (title: string) => boolean,
  get: GetJson,
  shouldStop: () => boolean,
  known: KnownOffers,
  /** Offres lues offre par offre (SmartRecruiters), gardées si la lecture s'interrompt. */
  offers: RawOffer[],
): Promise<CompanyOffers> {
  const { platform, slug, name } = company;
  const offer = (
    externalId: string,
    title: string,
    url: string,
    description: string,
    location: string | null,
    publishedAt: string | null,
  ): RawOffer => ({
    externalId: `${platform}-${slug}-${externalId}`,
    title: decodeHtml(title),
    company: name,
    description,
    url,
    location,
    publishedAt,
  });
  const done = (offers: RawOffer[]): CompanyOffers => ({ offers, failed: false, stopped: false });
  const failed: CompanyOffers = { offers: [], failed: true, stopped: false };

  if (platform === "greenhouse") {
    const data = await get<{ jobs?: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
    if (!data) return failed;
    return done(
      (data.jobs ?? [])
        .filter((j) => FRANCE.test(j.location?.name ?? "") || (j.offices ?? []).some((o) => FRANCE.test(`${o.name} ${o.location ?? ""}`)))
        .filter((j) => keep(j.title))
        .slice(0, limit)
        // Greenhouse renvoie le HTML de l'offre échappé (&lt;p&gt;…) : deux passes.
        .map((j) =>
          offer(
            String(j.id),
            j.title,
            j.absolute_url,
            decodeHtml(decodeHtml(j.content ?? "")),
            pickLocation([j.location?.name, ...(j.offices ?? []).flatMap((o) => [o.location, o.name])]),
            toIsoDate(j.first_published),
          ),
        ),
    );
  }

  if (platform === "lever" || platform === "lever-eu") {
    const host = platform === "lever-eu" ? "api.eu.lever.co" : "api.lever.co";
    const data = await get<LeverPosting[]>(`https://${host}/v0/postings/${slug}?mode=json`);
    if (!Array.isArray(data)) return failed;
    return done(
      data
        .filter((p) => p.country === "FR" || FRANCE.test([p.categories?.location, ...(p.categories?.allLocations ?? [])].join(" ")))
        .filter((p) => keep(p.text))
        .slice(0, limit)
        .map((p) => {
          const lists = (p.lists ?? []).map((l) => `${l.text ?? ""} ${decodeHtml(l.content ?? "")}`);
          return offer(
            p.id,
            p.text,
            p.hostedUrl,
            [p.descriptionPlain ?? "", ...lists, p.additionalPlain ?? ""].join("\n").trim(),
            pickLocation([p.categories?.location, ...(p.categories?.allLocations ?? [])]),
            toIsoDate(p.createdAt),
          );
        }),
    );
  }

  if (platform === "ashby") {
    const data = await get<{ jobs?: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (!data) return failed;
    return done(
      (data.jobs ?? [])
        .filter((j) => j.isListed !== false)
        .filter(
          (j) =>
            /france/i.test(j.address?.postalAddress?.addressCountry ?? "") ||
            FRANCE.test([j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].join(" ")),
        )
        .filter((j) => keep(j.title))
        .slice(0, limit)
        .map((j) =>
          offer(
            j.id,
            j.title,
            j.jobUrl,
            j.descriptionPlain ?? "",
            pickLocation([j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)]),
            toIsoDate(j.publishedAt),
          ),
        ),
    );
  }

  // SmartRecruiters : 100 offres par page (5 pages au plus, pour trouver les postes filtrés chez
  // les grands employeurs) ; la liste ne contient pas la description, lue offre par offre.
  const postings: SmartRecruitersPosting[] = [];
  for (let offset = 0; offset < 500 && postings.length < limit; offset += 100) {
    const page = await get<{ content?: SmartRecruitersPosting[] }>(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?country=fr&limit=100&offset=${offset}`,
    );
    if (!page) {
      if (offset === 0) return failed;
      break;
    }
    const content = page.content ?? [];
    postings.push(...content.filter((p) => p.location?.country === "fr" && keep(p.name)));
    if (content.length < 100) break;
  }
  postings.splice(limit);
  const alreadySaved = await known(postings.map((posting) => `${platform}-${slug}-${posting.id}`));
  for (const posting of postings) {
    if (shouldStop()) return { offers, failed: false, stopped: true };
    if (alreadySaved.has(`${platform}-${slug}-${posting.id}`)) {
      // Offre déjà en base : revue (date et lieu mis à jour), sans relire sa description.
      offers.push(
        offer(
          posting.id,
          posting.name,
          `https://jobs.smartrecruiters.com/${slug}/${posting.id}`,
          "",
          pickLocation([posting.location?.city]),
          toIsoDate(posting.releasedDate),
        ),
      );
      continue;
    }
    const detail = await get<SmartRecruitersDetail>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${posting.id}`);
    if (!detail) continue;
    const sections = Object.values(detail.jobAd?.sections ?? {}).map((s) => decodeHtml(s?.text ?? ""));
    offers.push(
      offer(
        posting.id,
        posting.name,
        detail.postingUrl ?? `https://jobs.smartrecruiters.com/${slug}/${posting.id}`,
        sections.join("\n").trim(),
        pickLocation([posting.location?.city]),
        toIsoDate(posting.releasedDate),
      ),
    );
  }
  return done(offers);
}

export type SectorCollection = {
  companiesRead: number;
  companiesTotal: number;
  /** Entreprises en échec (page illisible, panne, accès refusé). */
  companiesFailed: string[];
  /** Entreprises lues sans échec, sans aucune offre retenue (en France, du métier du secteur). */
  companiesEmpty: string[];
  offersRead: number;
  /** Offres retenues par entreprise, dans l'ordre de lecture. */
  perCompany: { name: string; offers: number; failed: boolean }[];
  /** Arrêt avant la fin (temps écoulé) : les entreprises suivantes attendront le prochain passage. */
  partial: boolean;
};

/** Lit les entreprises d'un secteur une par une ; `onCompany` reçoit leurs offres aussitôt. */
export async function collectSector({
  sector,
  companies,
  limit = ATS_OFFERS_PER_COMPANY,
  get,
  shouldStop = () => false,
  known = NONE_KNOWN,
  onCompany,
  onBlocked = () => {},
}: {
  sector: Sector;
  companies: AtsCompany[];
  limit?: number;
  get: GetJson;
  shouldStop?: () => boolean;
  known?: KnownOffers;
  onCompany: (company: AtsCompany, offers: RawOffer[]) => Promise<void> | void;
  /** Accès refusé par l'entreprise : appelé après onCompany (offres déjà lues enregistrées). */
  onBlocked?: (company: AtsCompany, blocked: NonNullable<CompanyOffers["blocked"]>) => Promise<void> | void;
}): Promise<SectorCollection> {
  const result: SectorCollection = {
    companiesRead: 0,
    companiesTotal: companies.length,
    companiesFailed: [],
    companiesEmpty: [],
    offersRead: 0,
    perCompany: [],
    partial: false,
  };
  for (const company of companies) {
    if (shouldStop()) {
      result.partial = true;
      break;
    }
    const filter = company.filterTitles || ALWAYS_FILTERED.has(sector) ? TITLE_FILTERS[sector] : undefined;
    const read = await readCompanyOffers(company, limit, (title) => !filter || filter.test(title), get, shouldStop, known);
    const offers = read.offers.map((offer) => ({ ...offer, products: company.products }));
    if (read.failed) result.companiesFailed.push(company.name);
    else if (!offers.length && !read.stopped) result.companiesEmpty.push(company.name);
    result.companiesRead++;
    result.offersRead += offers.length;
    result.perCompany.push({ name: company.name, offers: offers.length, failed: read.failed });
    await onCompany(company, offers);
    if (read.blocked) await onBlocked(company, read.blocked);
    if (read.stopped) {
      result.partial = true;
      break;
    }
  }
  return result;
}

// --- Enregistrement ---------------------------------------------------------------------------

export type OfferToSave = RawOffer & { source: string; sector: Sector; keywords: string[] };
export type SaveResult = { created: number; seen: number };

const LOOKUP_CHUNK = 200;
const TOP_TRENDS = 30;

/** Sépare les offres nouvelles des offres revues, regroupées par lieu pour une seule requête chacune. */
export function planOfferSave(offers: OfferToSave[], existing: { id: string; external_id: string }[]) {
  const ids = new Map(existing.map((row) => [row.external_id, row.id]));
  const unique = [...new Map(offers.map((offer) => [offer.externalId, offer])).values()];
  const groups = new Map<string | null, string[]>();
  for (const offer of unique) {
    const id = ids.get(offer.externalId);
    if (id) groups.set(offer.location, [...(groups.get(offer.location) ?? []), id]);
  }
  return {
    toInsert: unique.filter((offer) => !ids.has(offer.externalId)),
    toRefresh: [...groups].map(([location, rowIds]) => ({ location, ids: rowIds })),
  };
}

/** Description gardée en base : coordonnées masquées, 4 000 caractères au plus. */
export function storedDescription(description: string) {
  return maskContacts(description).slice(0, STORED_DESCRIPTION_MAX_LENGTH);
}

/**
 * Offre nouvelle : enregistrée (intitulé et description sans coordonnées, description limitée à
 * 4 000 caractères), ses mots-clés comptés sur le texte complet. Offre déjà connue : last_seen_at
 * et lieu mis à jour, sans recompter ses mots-clés. Le secteur et scraped_at (première vue) ne
 * changent jamais. Un lieu absent de la source n'efface pas le lieu déjà connu.
 */
export async function saveOffers(supabase: SupabaseClient, offers: OfferToSave[], now = new Date()): Promise<SaveResult> {
  const result: SaveResult = { created: 0, seen: 0 };
  const lastSeen = now.toISOString();
  for (const source of new Set(offers.map((offer) => offer.source))) {
    const sourceOffers = offers.filter((offer) => offer.source === source);
    const existing: { id: string; external_id: string }[] = [];
    for (let from = 0; from < sourceOffers.length; from += LOOKUP_CHUNK) {
      const { data, error } = await supabase
        .from("job_offers_raw")
        .select("id, external_id")
        .eq("source", source)
        .in("external_id", sourceOffers.slice(from, from + LOOKUP_CHUNK).map((offer) => offer.externalId));
      if (error) throw error;
      existing.push(...((data ?? []) as { id: string; external_id: string }[]));
    }

    const { toInsert, toRefresh } = planOfferSave(sourceOffers, existing);
    for (const { location, ids } of toRefresh) {
      const { error } = await supabase
        .from("job_offers_raw")
        .update({ last_seen_at: lastSeen, ...(location ? { location } : {}) })
        .in("id", ids);
      if (error) throw error;
      result.seen += ids.length;
    }
    for (const offer of toInsert) {
      const { data, error } = await supabase
        .from("job_offers_raw")
        .upsert(
          {
            source: offer.source,
            external_id: offer.externalId,
            title: maskContacts(offer.title),
            company: offer.company,
            sector: offer.sector,
            description: storedDescription(offer.description),
            url: offer.url,
            location: offer.location,
            published_at: offer.publishedAt,
            last_seen_at: lastSeen,
          },
          { onConflict: "source,external_id", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      // Enregistrée entre-temps par un autre passage : pas de second comptage.
      if (!data?.length) continue;
      result.created++;
      if (offer.keywords.length) {
        const { error: rpcError } = await supabase.rpc("increment_job_keywords", {
          p_sector: offer.sector,
          p_keywords: offer.keywords,
          p_source: offer.source,
        });
        if (rpcError) throw rpcError;
      }
    }
  }
  return result;
}

// --- Passage du cron ---------------------------------------------------------------------------

/** Temps de lecture d'un passage : marge sous les 300 s d'une fonction Vercel (plan Hobby). */
export const COLLECT_BUDGET_MS = 240_000;
const COLLECT_SOURCE = "ats";
const SAMPLE_SIZE = 5;

/** Offre collectée non revue depuis ce délai : supprimée en fin de passage. */
export const COLLECTED_OFFERS_MAX_DAYS = 60;
/** Offre collée par un utilisateur (source « user ») : gardée plus longtemps. */
export const USER_OFFERS_MAX_DAYS = 180;
/** Nettoyage sauté s'il reste moins que ce temps avant la fin du budget du passage. */
export const PURGE_MIN_REMAINING_MS = 10_000;

const DAY_MS = 86_400_000;

/** Dates limites du nettoyage (ISO) : une offre non revue depuis avant elles est supprimée. */
export function purgeCutoffs(now: number) {
  return {
    p_collected_before: new Date(now - COLLECTED_OFFERS_MAX_DAYS * DAY_MS).toISOString(),
    p_user_before: new Date(now - USER_OFFERS_MAX_DAYS * DAY_MS).toISOString(),
  };
}

export type CollectRun = {
  sector: Sector;
  source: string;
  dryRun: boolean;
  startedAt: string;
  durationMs: number;
  companiesRead: number;
  companiesTotal: number;
  companiesFailed: string[];
  /** Entreprises lues sans échec et sans aucune offre retenue. */
  companiesEmpty: string[];
  /** Entreprises retirées : déjà retirées (ignorées), ou retirées pendant ce passage. */
  companiesExcluded: string[];
  /** Entreprises arrêtées par un 429 sans défi anti-robot (retirées au deuxième passage consécutif). */
  companiesRateLimited: string[];
  offersRead: number;
  offersCreated: number;
  offersSeen: number;
  /** Offres retenues par entreprise lue (bilan du passage, aussi dans la console). */
  perCompany: SectorCollection["perCompany"];
  partial: boolean;
  error: string | null;
  /** Offres supprimées par le nettoyage ; null s'il n'a pas tourné. */
  offersDeleted: number | null;
  /** Erreur du nettoyage, ou raison pour laquelle il a été sauté ; ne fait jamais échouer le passage. */
  purgeError: string | null;
  /** Essai à blanc : quelques offres lues, pour contrôler le résultat. */
  sample?: { title: string; company: string | null; location: string | null }[];
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);

/** Règle du 429 : le passage précédent pris en compte a commencé il y a au moins ce nombre de jours. */
export const RATE_LIMIT_MEMORY_MIN_DAYS = 5;
const KNOWN_LOOKUP_CHUNK = 200;

/**
 * Entreprises retirées de la collecte (clés « plateforme:identifiant »). Sans échec : table absente
 * (migration 0043 pas encore lancée) ou illisible → aucune, avec un avertissement.
 */
export async function loadExclusions(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await supabase.from("job_collect_exclusions").select("company_key");
    if (error) throw error;
    return new Set(((data ?? []) as { company_key: string }[]).map((row) => row.company_key));
  } catch (caught) {
    console.warn("[collecte] retraits illisibles (migration 0043 ?)", errorMessage(caught));
    return new Set();
  }
}

/**
 * Entreprises arrêtées par un 429 lors du passage précédent de CE secteur, celui de la semaine
 * d'avant : le plus récent commencé il y a au moins 5 jours. Jamais un autre secteur (même jour ou
 * non), jamais un passage de moins de 5 jours (relance à la main). Sans échec : colonne absente ou
 * journal illisible → aucune.
 */
async function previouslyRateLimited(supabase: SupabaseClient, sector: Sector, now: number): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("job_collect_runs")
      .select("started_at, companies_rate_limited")
      .eq("sector", sector)
      .eq("source", COLLECT_SOURCE)
      .lte("started_at", new Date(now - RATE_LIMIT_MEMORY_MIN_DAYS * DAY_MS).toISOString())
      .order("started_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const previous = ((data ?? []) as { companies_rate_limited: string[] | null }[])[0];
    return new Set(previous?.companies_rate_limited ?? []);
  } catch (caught) {
    console.warn("[collecte] journal des 429 illisible (migration 0043 ?)", errorMessage(caught));
    return new Set();
  }
}

/** Offres déjà en base (source « ats ») parmi des identifiants ; sans échec : aucune connue. */
function knownOffersIn(supabase: SupabaseClient): KnownOffers {
  return async (externalIds) => {
    const known = new Set<string>();
    try {
      for (let from = 0; from < externalIds.length; from += KNOWN_LOOKUP_CHUNK) {
        const { data, error } = await supabase
          .from("job_offers_raw")
          .select("external_id")
          .eq("source", COLLECT_SOURCE)
          .in("external_id", externalIds.slice(from, from + KNOWN_LOOKUP_CHUNK));
        if (error) throw error;
        for (const row of (data ?? []) as { external_id: string }[]) known.add(row.external_id);
      }
    } catch (caught) {
      console.warn("[collecte] offres connues illisibles : descriptions relues", errorMessage(caught));
    }
    return known;
  };
}

/**
 * Retrait noté dans job_collect_exclusions ; false si l'écriture a échoué (erreur dans la console).
 * Sans échec : l'entreprise reste arrêtée pour ce passage, mais sera relue au suivant.
 */
async function recordExclusion(
  supabase: SupabaseClient,
  company: AtsCompany,
  blocked: NonNullable<CompanyOffers["blocked"]>,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("job_collect_exclusions").upsert(
      {
        company_key: companyKey(company),
        company_name: company.name,
        reason: blocked.reason,
        detail: `HTTP ${blocked.status} ${blocked.url}`.slice(0, 500),
      },
      { onConflict: "company_key", ignoreDuplicates: true },
    );
    if (error) throw error;
    return true;
  } catch (caught) {
    console.error("[collecte] retrait non enregistré", company.name, errorMessage(caught));
    return false;
  }
}

/** Mention ajoutée au nom, dans companies_excluded, quand le retrait n'a pas pu être enregistré. */
export const EXCLUSION_NOT_SAVED = " (retrait non enregistré)";

/** Colonnes ajoutées par la migration 0043 ; codes PostgREST / Postgres d'une colonne inconnue. */
const MISSING_COLUMN = /PGRST204|42703/;

/**
 * Un passage sur un secteur : entreprises retirées ignorées, offres enregistrées entreprise par
 * entreprise (pour qu'un arrêt ou une erreur garde le travail déjà fait), puis classement, journal
 * et nettoyage des vieilles offres. `supabase` null : essai à blanc, aucune lecture ni écriture en
 * base (les refus d'accès sont seulement signalés).
 *
 * Refus d'accès : 401, 403 ou défi anti-robot → entreprise retirée tout de suite ; 429 sans défi →
 * arrêtée pour ce passage, retirée si le passage de la semaine précédente du même secteur (au moins
 * 5 jours avant) l'avait déjà notée en 429.
 */
export async function runSectorCollection({
  sector,
  companies,
  supabase,
  get,
  matchKeywords,
  budgetMs = COLLECT_BUDGET_MS,
  now = Date.now,
}: {
  sector: Sector;
  companies: AtsCompany[];
  supabase: SupabaseClient | null;
  get: GetJson;
  matchKeywords: (text: string, sector: Sector, excluded: (string | null | undefined)[]) => string[];
  budgetMs?: number;
  now?: () => number;
}): Promise<CollectRun> {
  const started = now();
  const counters = { companiesRead: 0, offersRead: 0, offersCreated: 0, offersSeen: 0 };
  const sample: NonNullable<CollectRun["sample"]> = [];
  const excludedNames: string[] = [];
  const rateLimited: string[] = [];
  let collection: SectorCollection | null = null;
  let error: string | null = null;

  const exclusions = supabase ? await loadExclusions(supabase) : new Set<string>();
  const active = companies.filter((company) => {
    if (!exclusions.has(companyKey(company))) return true;
    excludedNames.push(company.name);
    return false;
  });
  const strikes = supabase ? await previouslyRateLimited(supabase, sector, started) : new Set<string>();

  try {
    collection = await collectSector({
      sector,
      companies: active,
      get,
      shouldStop: () => now() - started >= budgetMs,
      known: supabase ? knownOffersIn(supabase) : NONE_KNOWN,
      onCompany: async (_company, offers) => {
        counters.companiesRead++;
        counters.offersRead += offers.length;
        if (!supabase) {
          for (const { title, company, location } of offers) if (sample.length < SAMPLE_SIZE) sample.push({ title, company, location });
          return;
        }
        const saved = await saveOffers(
          supabase,
          offers.map((offer) => ({
            ...offer,
            source: COLLECT_SOURCE,
            sector,
            keywords: matchKeywords(`${offer.title} ${offer.description}`, sector, [offer.company, ...(offer.products ?? [])]),
          })),
        );
        counters.offersCreated += saved.created;
        counters.offersSeen += saved.seen;
      },
      onBlocked: async (company, blocked) => {
        if (blocked.reason === "http_429" && !strikes.has(company.name)) {
          rateLimited.push(company.name);
          return;
        }
        // Plus aucune requête vers elle pendant ce passage (lecture déjà arrêtée), même si
        // l'écriture du retrait échoue : le journal le dit alors à côté du nom.
        const saved = supabase ? await recordExclusion(supabase, company, blocked) : true;
        excludedNames.push(saved ? company.name : `${company.name}${EXCLUSION_NOT_SAVED}`);
      },
    });
    if (supabase) await refreshTrends(supabase, sector);
  } catch (caught) {
    error = errorMessage(caught);
  }

  const run: CollectRun = {
    sector,
    source: COLLECT_SOURCE,
    dryRun: !supabase,
    startedAt: new Date(started).toISOString(),
    durationMs: now() - started,
    companiesRead: counters.companiesRead,
    companiesTotal: companies.length,
    companiesFailed: collection?.companiesFailed ?? [],
    companiesEmpty: collection?.companiesEmpty ?? [],
    companiesExcluded: excludedNames,
    companiesRateLimited: rateLimited,
    offersRead: counters.offersRead,
    offersCreated: counters.offersCreated,
    offersSeen: counters.offersSeen,
    perCompany: collection?.perCompany ?? [],
    partial: collection ? collection.partial : true,
    error,
    offersDeleted: null,
    purgeError: supabase ? null : "sauté : essai à blanc",
    ...(supabase ? {} : { sample }),
  };
  if (!supabase) return run;

  // Sans échec : le journal ne doit pas faire échouer un passage déjà enregistré.
  const logId = await writeRunLog(supabase, run);

  // Nettoyage après le journal : son résultat complète la même ligne.
  await purgeStaleOffers(supabase, run, budgetMs - (now() - started), now());
  if (logId) {
    const { error: updateError } = await supabase
      .from("job_collect_runs")
      .update({ offers_deleted: run.offersDeleted, purge_error: run.purgeError })
      .eq("id", logId);
    if (updateError) console.error("[collecte] journal du nettoyage", updateError.message);
  } else {
    console.info("[collecte] nettoyage", JSON.stringify({ sector, offersDeleted: run.offersDeleted, purgeError: run.purgeError }));
  }
  return run;
}

/**
 * Ligne du journal ; identifiant, ou null si elle n'a pas pu être écrite. Sans les colonnes de la
 * migration 0043 (pas encore lancée), la ligne est réécrite sans elles.
 */
async function writeRunLog(supabase: SupabaseClient, run: CollectRun): Promise<string | null> {
  const row = {
    sector: run.sector,
    source: run.source,
    started_at: run.startedAt,
    duration_ms: run.durationMs,
    companies_read: run.companiesRead,
    companies_total: run.companiesTotal,
    companies_failed: run.companiesFailed,
    offers_read: run.offersRead,
    offers_created: run.offersCreated,
    offers_seen: run.offersSeen,
    partial: run.partial,
    error: run.error,
  };
  const insert = (values: Record<string, unknown>) => supabase.from("job_collect_runs").insert(values).select("id").single();
  let { data, error } = await insert({
    ...row,
    companies_empty: run.companiesEmpty,
    companies_excluded: run.companiesExcluded,
    companies_rate_limited: run.companiesRateLimited,
  });
  if (error && MISSING_COLUMN.test(`${(error as { code?: string }).code ?? ""} ${error.message}`)) {
    console.warn("[collecte] journal sans les colonnes de la migration 0043");
    ({ data, error } = await insert(row));
  }
  if (error) console.error("[collecte] journal", error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Supprime les offres du secteur non revues depuis 60 jours (180 pour les offres collées), jamais
 * une offre liée à une candidature (fonction purge_stale_job_offers, migration 0037). Sauté après un
 * passage en erreur ou faute de temps ; une erreur est notée dans `purgeError`, jamais levée.
 */
async function purgeStaleOffers(supabase: SupabaseClient, run: CollectRun, remainingMs: number, now: number) {
  if (run.error) {
    run.purgeError = "sauté : passage en erreur";
    return;
  }
  if (remainingMs < PURGE_MIN_REMAINING_MS) {
    run.purgeError = "sauté : temps restant trop court";
    return;
  }
  try {
    const { data, error } = await supabase.rpc("purge_stale_job_offers", { p_sector: run.sector, ...purgeCutoffs(now) });
    if (error) throw error;
    run.offersDeleted = typeof data === "number" ? data : Number(data ?? 0);
  } catch (caught) {
    run.purgeError = errorMessage(caught);
  }
}

/** Recalcule le classement des mots-clés d'un secteur. */
export async function refreshTrends(supabase: SupabaseClient, sector: Sector) {
  const { data, error } = await supabase
    .from("job_keywords")
    .select("keyword, frequency")
    .eq("sector", sector)
    .order("frequency", { ascending: false })
    .limit(TOP_TRENDS);
  if (error) throw error;
  const { error: upsertError } = await supabase
    .from("sector_trends")
    .upsert({ sector, top_keywords: data ?? [], updated_at: new Date().toISOString() }, { onConflict: "sector" });
  if (upsertError) throw upsertError;
}
