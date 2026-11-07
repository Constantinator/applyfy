// Collecte des offres sur les API publiques, sans clé, des pages carrières (Greenhouse, Lever,
// Ashby, SmartRecruiters) des entreprises de ats-companies.json. Seules les offres en France sont
// gardées. Partagé entre le cron (app/api/cron/collecte) et scripts/scrape-jobs.ts : pas d'import
// propre à Next.js ici.
//
// Dans ats-companies.json, `products` liste les produits de l'entreprise, exclus des mots-clés
// comme son nom ; `filterTitles` ne garde que les offres du métier du secteur (marque grand public
// classée en marketing : postes marketing seulement).
import type { Sector } from "./cv-sector-context";

export type AtsPlatform = "greenhouse" | "lever" | "lever-eu" | "ashby" | "smartrecruiters";
export type AtsCompany = { name: string; platform: AtsPlatform; slug: string; products?: string[]; filterTitles?: boolean };

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

/** GET JSON avec un délai minimum entre deux requêtes ; null si la réponse n'est pas exploitable. */
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
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": collectUserAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(ATS_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) {
        log(`ats : ${url} → HTTP ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      log(`ats : ${url} → ${error instanceof Error ? error.message : error}`);
      return null;
    }
  };
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

/** Lieu affiché : le premier situé en France, sinon le premier renseigné. */
function pickLocation(candidates: (string | null | undefined)[]): string | null {
  const known = candidates.map((value) => decodeHtml(value ?? "")).filter(Boolean);
  const place = known.find((value) => FRANCE.test(value)) ?? known[0];
  return place ? place.slice(0, LOCATION_MAX_LENGTH) : null;
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
};

/** Offres en France d'une entreprise (au plus `limit`), avec leur description. */
export async function readCompanyOffers(
  company: AtsCompany,
  limit: number,
  keep: (title: string) => boolean,
  get: GetJson,
  shouldStop: () => boolean = () => false,
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
  const offers: RawOffer[] = [];
  for (const posting of postings) {
    if (shouldStop()) return { offers, failed: false, stopped: true };
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
  companiesFailed: string[];
  offersRead: number;
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
  onCompany,
}: {
  sector: Sector;
  companies: AtsCompany[];
  limit?: number;
  get: GetJson;
  shouldStop?: () => boolean;
  onCompany: (company: AtsCompany, offers: RawOffer[]) => Promise<void> | void;
}): Promise<SectorCollection> {
  const result: SectorCollection = {
    companiesRead: 0,
    companiesTotal: companies.length,
    companiesFailed: [],
    offersRead: 0,
    partial: false,
  };
  for (const company of companies) {
    if (shouldStop()) {
      result.partial = true;
      break;
    }
    const filter = company.filterTitles || ALWAYS_FILTERED.has(sector) ? TITLE_FILTERS[sector] : undefined;
    const read = await readCompanyOffers(company, limit, (title) => !filter || filter.test(title), get, shouldStop);
    const offers = read.offers.map((offer) => ({ ...offer, products: company.products }));
    if (read.failed) result.companiesFailed.push(company.name);
    result.companiesRead++;
    result.offersRead += offers.length;
    await onCompany(company, offers);
    if (read.stopped) {
      result.partial = true;
      break;
    }
  }
  return result;
}
