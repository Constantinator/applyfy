// Collecte d'offres d'emploi pour alimenter job_offers_raw, job_keywords et sector_trends
// (migration 0032), lus par src/lib/job-scraper.ts. Deux familles de sources :
// - API officielles France Travail et Adzuna, via les clients de l'application
//   (src/lib/france-travail.ts, src/lib/adzuna.ts) et leurs identifiants habituels ;
// - pages publiques de WTTJ, Indeed, APEC, Cadremploi et JobTeaser.
//
// Usage :
//   node --env-file=.env.local scripts/scrape-jobs.ts [--sector finance] [--source france-travail] [--limit 10] [--dry-run]
//
// Collecte respectueuse des pages publiques : robots.txt lu et appliqué pour chaque site, un
// robot identifié (USER_AGENT), une requête toutes les 3 s au plus par site (ou le Crawl-delay
// demandé), et arrêt de la source dès qu'elle refuse l'accès (403, 429, captcha, page
// anti-robots). Aucun contournement : une source qui bloque est ignorée et signalée dans le bilan.
// Le texte de ces offres est lu dans leurs données structurées JSON-LD (JobPosting).
//
// Mots-clés retenus : ceux de la base sectorielle (src/lib/cv-knowledge-base.json) présents
// dans l'intitulé ou la description de l'offre.

import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import type { Sector, SectorContext } from "../src/lib/cv-sector-context";
import type { OfferListing } from "../src/lib/offer-types";

const USER_AGENT = `ApplyfyBot/0.1 (+${process.env.APP_URL || "https://applyfy.fr"})`;
const MIN_DELAY_MS = 3_000;
const TIMEOUT_MS = 20_000;
const TOP_TRENDS = 30;

// Les clients d'API de l'application sont écrits pour Next.js : « server-only », alias « @/ »
// et imports sans extension. Ces hooks les rendent chargeables par Node (Node 24).
const SRC = new URL("../src/", import.meta.url);
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  next: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;
(nodeModule as unknown as { registerHooks(hooks: { resolve: ResolveHook }): void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), SRC)
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
        ? new URL(specifier, context.parentURL)
        : null;
    if (target && !/\.[cm]?[jt]s$|\.json$/.test(target.pathname) && existsSync(fileURLToPath(`${target.href}.ts`)))
      return next(`${target.href}.ts`, context);
    return next(target?.href ?? specifier, context);
  },
});

const knowledge = JSON.parse(
  readFileSync(new URL("../src/lib/cv-knowledge-base.json", import.meta.url), "utf8"),
) as { sectors: Record<Sector, SectorContext> };
const SECTORS = Object.keys(knowledge.sectors) as Sector[];

/** Recherche lancée sur chaque source pour un secteur. */
const QUERIES: Record<Sector, string> = {
  finance: "analyste financier",
  conseil: "consultant",
  tech: "développeur",
  marketing: "chargé de marketing",
  creatif: "designer graphique",
  commercial: "commercial",
  rh: "chargé de recrutement",
  sante: "infirmier",
  etudiant: "stage",
  luxe: "luxe",
};

/** Offre lue sur une source, avant extraction des mots-clés. */
type RawOffer = { externalId: string; title: string; company: string | null; description: string; url: string };

/** Une source : ses offres pour un secteur (au plus `limit`). */
type Collector = { id: string; collect: (sector: Sector, limit: number) => Promise<RawOffer[]> };

/** Source indisponible pour tout le passage (bloquée, non configurée, en erreur). */
class SourceUnavailable extends Error {}

// --- API officielles -------------------------------------------------------------------------

const search = (sector: Sector, page: number) => ({
  keywords: QUERIES[sector],
  department: null,
  contract: null,
  sort: "recent" as const,
  page,
});

/** Pages de résultats d'une API jusqu'à `limit` offres ; erreurs de la source → SourceUnavailable. */
async function paginate(id: string, limit: number, fetchPage: (page: number) => Promise<OfferListing[]>) {
  const { OfferSourceError } = await import("../src/lib/offer-types");
  const offers: OfferListing[] = [];
  try {
    for (let page = 1; offers.length < limit; page++) {
      const results = await fetchPage(page);
      offers.push(...results);
      if (!results.length) break;
    }
  } catch (error) {
    if (error instanceof OfferSourceError) throw new SourceUnavailable(`${id} : ${error.message}`);
    throw error;
  }
  return offers.slice(0, limit);
}

const toRaw = (offer: OfferListing, externalId = offer.id): RawOffer => ({
  externalId,
  title: offer.title,
  company: offer.company,
  description: offer.description,
  url: offer.url,
});

const franceTravail: Collector = {
  id: "france-travail",
  async collect(sector, limit) {
    const { isFranceTravailConfigured, searchFranceTravail } = await import("../src/lib/france-travail");
    if (!isFranceTravailConfigured())
      throw new SourceUnavailable("france-travail : FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET manquantes");
    const offers = await paginate(this.id, limit, async (page) => (await searchFranceTravail(search(sector, page))).offers);
    return offers.map((offer) => toRaw(offer));
  },
};

const adzuna: Collector = {
  id: "adzuna",
  async collect(sector, limit) {
    const { isAdzunaConfigured, searchAdzuna } = await import("../src/lib/adzuna");
    if (!isAdzunaConfigured()) throw new SourceUnavailable("adzuna : ADZUNA_APP_ID / ADZUNA_APP_KEY manquantes");
    const offers = await paginate(this.id, limit, async (page) => (await searchAdzuna(search(sector, page))).offers);
    // Adzuna ne renvoie qu'un extrait de la description (≈ 500 caractères).
    return offers.map((offer) => toRaw(offer, offer.id.replace(/^adzuna-/, "")));
  },
};

// --- Pages publiques -------------------------------------------------------------------------

type Site = {
  id: string;
  origin: string;
  searchUrl: (query: string) => string;
  /** Liens d'offres dans la page de résultats : capture 1 = identifiant de l'offre. */
  offerLink: RegExp;
  offerUrl: (id: string, match: string) => string;
};

// Schémas d'URL relevés sur les sites publics ; ils peuvent changer sans prévenir. Une page de
// résultats rendue en JavaScript ne contiendra aucun lien et la source ne renverra rien.
const SITES: Site[] = [
  {
    id: "wttj",
    origin: "https://www.welcometothejungle.com",
    searchUrl: (q) => `/fr/jobs?query=${encodeURIComponent(q)}`,
    offerLink: /\/fr\/companies\/[\w-]+\/jobs\/([\w-]+)/g,
    offerUrl: (_id, match) => match,
  },
  {
    id: "indeed",
    origin: "https://fr.indeed.com",
    searchUrl: (q) => `/jobs?q=${encodeURIComponent(q)}&l=France`,
    offerLink: /[?&]jk=([0-9a-f]{16})/g,
    offerUrl: (id) => `/viewjob?jk=${id}`,
  },
  {
    id: "apec",
    origin: "https://www.apec.fr",
    searchUrl: (q) => `/candidat/recherche-emploi.html/emploi?motsCles=${encodeURIComponent(q)}`,
    offerLink: /\/candidat\/recherche-emploi\.html\/emploi\/detail-offre\/(\w+)/g,
    offerUrl: (_id, match) => match,
  },
  {
    id: "cadremploi",
    origin: "https://www.cadremploi.fr",
    searchUrl: (q) => `/emploi/liste_offres?motscles=${encodeURIComponent(q)}`,
    offerLink: /\/emploi\/detail_offre\?offreId=(\d+)/g,
    offerUrl: (_id, match) => match,
  },
  {
    id: "jobteaser",
    origin: "https://www.jobteaser.com",
    searchUrl: (q) => `/fr/job-offers?q=${encodeURIComponent(q)}`,
    offerLink: /\/fr\/job-offers\/([0-9a-f-]{36})[\w-]*/g,
    offerUrl: (_id, match) => match,
  },
];

type Rule = { allow: boolean; pattern: string };
type Robots = { rules: Rule[]; crawlDelayMs: number };

/** Règles du groupe « ApplyfyBot » s'il existe, sinon du groupe « * » (RFC 9309). */
function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: Rule[]; crawlDelay?: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if ((field === "allow" || field === "disallow") && value) current.rules.push({ allow: field === "allow", pattern: value });
    if (field === "crawl-delay" && Number(value) > 0) current.crawlDelay = Number(value);
  }
  const group =
    groups.find((g) => g.agents.some((a) => a !== "*" && "applyfybot".includes(a))) ??
    groups.find((g) => g.agents.includes("*"));
  return { rules: group?.rules ?? [], crawlDelayMs: (group?.crawlDelay ?? 0) * 1000 };
}

function ruleMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Règle la plus longue qui correspond ; à longueur égale, Allow l'emporte. */
function isAllowed(robots: Robots, path: string) {
  let best: Rule | null = null;
  for (const rule of robots.rules) {
    if (!ruleMatches(rule.pattern, path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow))
      best = rule;
  }
  return best?.allow ?? true;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Client d'un site : délai entre requêtes, robots.txt, arrêt au premier refus. */
function createFetcher(site: Site) {
  let robots: Robots | null = null;
  let nextAt = 0;
  let delayMs = MIN_DELAY_MS;

  async function request(path: string) {
    const wait = nextAt - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt = Date.now() + delayMs;
    const response = await fetch(site.origin + path, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    if (
      response.status === 403 ||
      response.status === 429 ||
      response.status === 503 ||
      /captcha-delivery\.com|cf-chl|Attention Required! \| Cloudflare|Request blocked/i.test(body)
    )
      throw new SourceUnavailable(`${site.id} refuse l'accès (HTTP ${response.status})`);
    return { status: response.status, body };
  }

  return async function get(path: string): Promise<string | null> {
    if (!robots) {
      const { status, body } = await request("/robots.txt");
      // robots.txt absent (4xx) : tout est permis ; serveur en erreur : on s'abstient (RFC 9309).
      if (status >= 500) throw new SourceUnavailable(`${site.id} : robots.txt indisponible (HTTP ${status})`);
      robots = status === 200 ? parseRobots(body) : { rules: [], crawlDelayMs: 0 };
      delayMs = Math.max(MIN_DELAY_MS, robots.crawlDelayMs);
    }
    if (!isAllowed(robots, path)) {
      console.warn(`  ${site.id} : ${path} interdit par robots.txt`);
      return null;
    }
    const { status, body } = await request(path);
    return status === 200 ? body : null;
  };
}

function decodeHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) for (const item of node) yield* walk(item);
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    yield record;
    if (record["@graph"]) yield* walk(record["@graph"]);
  }
}

/** Premier JobPosting des blocs JSON-LD de la page, ou null. */
function findJobPosting(html: string) {
  const blocks = html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    for (const node of walk(data)) {
      const types = ([] as unknown[]).concat(node["@type"]);
      if (!types.includes("JobPosting") || typeof node.title !== "string") continue;
      const org = node.hiringOrganization as { name?: unknown } | undefined;
      return {
        title: decodeHtml(node.title),
        company: typeof org?.name === "string" ? decodeHtml(org.name) : null,
        description: typeof node.description === "string" ? decodeHtml(node.description) : "",
      };
    }
  }
  return null;
}

function siteCollector(site: Site): Collector {
  const get = createFetcher(site);
  return {
    id: site.id,
    async collect(sector, limit) {
      const html = await get(site.searchUrl(QUERIES[sector]));
      if (!html) return [];
      const links = new Map<string, string>();
      for (const match of html.matchAll(site.offerLink)) {
        if (links.size >= limit) break;
        links.set(match[1], site.offerUrl(match[1], match[0]));
      }
      if (!links.size) console.warn(`  ${site.id}/${sector} : aucun lien d'offre (page rendue en JavaScript ?)`);

      const offers: RawOffer[] = [];
      for (const [externalId, path] of links) {
        const page = await get(path);
        const job = page && findJobPosting(page);
        if (job) offers.push({ ...job, externalId, url: site.origin + path });
      }
      return offers;
    },
  };
}

const SOURCE_IDS = [franceTravail.id, adzuna.id, ...SITES.map((s) => s.id)];

function createCollectors(ids: string[]): Collector[] {
  return ids.map((id) => {
    if (id === franceTravail.id) return franceTravail;
    if (id === adzuna.id) return adzuna;
    return siteCollector(SITES.find((s) => s.id === id)!);
  });
}

// --- Mots-clés et enregistrement -------------------------------------------------------------

function normalize(text: string) {
  return ` ${text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
}

/** Mots-clés ATS du secteur présents dans l'offre (mot entier, sans accents ni casse). */
function matchKeywords(text: string, keywords: string[]) {
  const haystack = normalize(text);
  return keywords.filter((keyword) => {
    const k = normalize(keyword).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return k && new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`).test(haystack);
  });
}

type Offer = RawOffer & { source: string; sector: Sector; keywords: string[] };

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (--env-file=.env.local).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Supabase = ReturnType<typeof createAdminClient>;

/** Enregistre les offres nouvelles et compte leurs mots-clés ; une offre déjà vue n'est pas recomptée. */
async function save(supabase: Supabase, offers: Offer[]) {
  let saved = 0;
  for (const offer of offers) {
    const { data, error } = await supabase
      .from("job_offers_raw")
      .upsert(
        {
          source: offer.source,
          external_id: offer.externalId,
          title: offer.title,
          company: offer.company,
          sector: offer.sector,
          description: offer.description,
          url: offer.url,
        },
        { onConflict: "source,external_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    if (!data?.length) continue;
    saved++;
    if (offer.keywords.length) {
      const { error: rpcError } = await supabase.rpc("increment_job_keywords", {
        p_sector: offer.sector,
        p_keywords: offer.keywords,
        p_source: offer.source,
      });
      if (rpcError) throw rpcError;
    }
  }
  return saved;
}

async function refreshTrends(supabase: Supabase, sector: Sector) {
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

// --- Exécution -------------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const value = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sector = value("sector");
  const source = value("source");
  const limit = Number(value("limit") ?? 10);
  if (sector && !SECTORS.includes(sector as Sector)) throw new Error(`Secteur inconnu : ${sector} (${SECTORS.join(", ")})`);
  if (source && !SOURCE_IDS.includes(source)) throw new Error(`Source inconnue : ${source} (${SOURCE_IDS.join(", ")})`);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit doit être un entier positif.");
  return {
    sectors: sector ? [sector as Sector] : SECTORS,
    sources: source ? [source] : SOURCE_IDS,
    limit,
    dryRun: argv.includes("--dry-run"),
  };
}

async function main() {
  const { sectors, sources, limit, dryRun } = parseArgs(process.argv.slice(2));
  const supabase = dryRun ? null : createAdminClient();
  const report: string[] = [];

  for (const collector of createCollectors(sources)) {
    let found = 0;
    let saved = 0;
    try {
      for (const sector of sectors) {
        console.log(`${collector.id}/${sector} : « ${QUERIES[sector]} »`);
        const offers = (await collector.collect(sector, limit)).map((offer) => ({
          ...offer,
          source: collector.id,
          sector,
          keywords: matchKeywords(`${offer.title} ${offer.description}`, knowledge.sectors[sector].ats_keywords),
        }));
        found += offers.length;
        for (const offer of offers)
          console.log(`  ${offer.title} — ${offer.keywords.length ? offer.keywords.join(", ") : "aucun mot-clé"}`);
        if (supabase) saved += await save(supabase, offers);
      }
      report.push(`${collector.id} : ${found} offre(s) lue(s)${supabase ? `, ${saved} nouvelle(s)` : ""}`);
    } catch (error) {
      if (!(error instanceof SourceUnavailable)) throw error;
      console.warn(`  ${error.message} : source ignorée.`);
      report.push(`${collector.id} : indisponible (${error.message})${found ? `, ${found} offre(s) lue(s) avant` : ""}`);
    }
  }

  if (supabase) for (const sector of sectors) await refreshTrends(supabase, sector);
  console.log(`\nBilan${dryRun ? " (dry-run, rien n'est enregistré)" : ""} :\n${report.map((line) => `- ${line}`).join("\n")}`);
}

await main();
