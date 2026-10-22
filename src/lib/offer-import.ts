import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { checkAiRateLimit } from "./ai-usage";
import { extractOfferFields, isClaudeConfigured, type OfferFields } from "./claude";
import { decodeEntities, formatOfferDescription } from "./format-offer";

export type ImportedOffer = {
  position: string;
  company: string;
  location: string;
  description: string;
  /**
   * D'où viennent les infos : données structurées de la page, extraction IA (page lue
   * directement, via Jina, ou texte collé par l'utilisateur) ou balises meta.
   */
  source: "structured" | "ai" | "jina" | "text" | "meta";
};

/** "not_found" : l'offre n'existe plus ; "failed" : page illisible, le texte peut être collé à la main. */
export type OfferImportErrorKind = "not_found" | "failed";

export class OfferImportError extends Error {
  constructor(
    message: string,
    readonly kind: OfferImportErrorKind = "failed",
  ) {
    super(message);
  }
}

const NOT_FOUND_MESSAGE = "Cette offre n'existe plus ou a été retirée.";

/** Titre de page d'erreur (certains sites répondent 200 pour une offre supprimée). */
function isNotFoundTitle(title: string) {
  return /^\s*(erreur\s*404|error\s*404|404\b|page (introuvable|non trouvée|not found)|not found)/i.test(title);
}

// ---------------------------------------------------------------------------
// Récupération de la page — protégée contre le SSRF (le serveur ne doit jamais
// servir de relais vers le réseau interne ou les métadonnées du cloud).
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // dont les métadonnées cloud (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast + réservé
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isBlockedAddress(address: string) {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OfferImportError("Lien invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OfferImportError("Seuls les liens http(s) sont acceptés.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new OfferImportError("Ce lien n'est pas pris en charge.");
  }
  if (url.username || url.password) throw new OfferImportError("Ce lien n'est pas pris en charge.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new OfferImportError("Site introuvable.");
      });
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new OfferImportError("Ce lien n'est pas pris en charge.");
  }
  // Limite connue : une résolution DNS différente au moment du fetch (DNS rebinding)
  // n'est pas couverte ; acceptable pour une lecture de pages publiques sans cookies.
  return url;
}

async function fetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual", // chaque redirection est revalidée
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ApplyfyBot/1.0; +https://applyfy-six.vercel.app)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        },
      });
    } catch {
      throw new OfferImportError("La page n'a pas répondu à temps.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, url).toString();
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      throw new OfferImportError(NOT_FOUND_MESSAGE, "not_found");
    }
    if (!response.ok) {
      throw new OfferImportError(
        response.status === 403 || response.status === 429
          ? "Ce site bloque la lecture automatique de ses offres."
          : "Impossible d'ouvrir cette page.",
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new OfferImportError("Ce lien ne pointe pas vers une page web.");

    return { html: await readLimited(response), finalUrl: url.toString() };
  }
  throw new OfferImportError("Trop de redirections.");
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break; // on garde le début de la page : les métadonnées sont dans le <head>
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

// ---------------------------------------------------------------------------
// Lecture de secours via Jina Reader (https://jina.ai/reader) : rend la page côté
// Jina (JavaScript compris) et renvoie son contenu en markdown. Utilisée seulement
// quand la page n'est pas lisible directement ou ne publie pas de données structurées.
// ---------------------------------------------------------------------------

const JINA_TIMEOUT_MS = 15_000;

async function fetchViaJina(url: string): Promise<string> {
  const apiKey = process.env.JINA_API_KEY; // optionnelle : sans clé, débit limité par Jina
  let response: Response;
  try {
    response = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
      headers: {
        Accept: "text/plain",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
  } catch {
    throw new OfferImportError("La page n'a pas répondu à temps.");
  }
  if (!response.ok) {
    console.error(`[offer-import] Jina ${response.status}`);
    throw new OfferImportError("Impossible de lire cette page.");
  }

  const markdown = await readLimited(response);
  const title = markdown.match(/^Title:\s*(.*)$/m)?.[1] ?? "";
  if (isNotFoundTitle(title) || /^Warning: Target URL returned error 404/m.test(markdown)) {
    throw new OfferImportError(NOT_FOUND_MESSAGE, "not_found");
  }
  return cleanMarkdown(markdown);
}

/** Retire images et URLs des liens : du bruit (et des tokens) pour l'extraction. */
function cleanMarkdown(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Analyse du HTML
// ---------------------------------------------------------------------------

/** Description JSON-LD → texte structuré (titres, paragraphes, puces), contenu inchangé. */
function formatJobDescription(raw: string) {
  // Certains sites encodent le HTML de la description en entités (&lt;p&gt;…).
  const html = raw.includes("&lt;") && !raw.includes("<") ? decodeEntities(raw) : raw;
  return formatOfferDescription(html);
}

/** HTML → texte lisible, pour l'extraction par Claude (listes et paragraphes conservés). */
function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type JsonLd = Record<string, unknown>;

function* walkJsonLd(node: unknown): Generator<JsonLd> {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJsonLd(item);
  } else if (node && typeof node === "object") {
    const obj = node as JsonLd;
    yield obj;
    if (obj["@graph"]) yield* walkJsonLd(obj["@graph"]);
  }
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "name" in value) return asText((value as JsonLd).name);
  return "";
}

function jobLocation(job: JsonLd): string {
  if (String(job.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE") return "Télétravail";
  const locations = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];
  for (const loc of locations) {
    const address = (loc as JsonLd | undefined)?.address;
    if (typeof address === "string") return address;
    if (address && typeof address === "object") {
      const a = address as JsonLd;
      const parts = [a.addressLocality, a.addressRegion, a.addressCountry]
        .map(asText)
        .filter(Boolean);
      if (parts.length) return [...new Set(parts)].slice(0, 2).join(", ");
    }
  }
  return "";
}

function findJobPosting(html: string): ImportedOffer | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, raw] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    for (const node of walkJsonLd(data)) {
      const type = node["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes("JobPosting")) continue;
      return {
        position: decodeEntities(asText(node.title)),
        company: decodeEntities(asText(node.hiringOrganization)),
        location: decodeEntities(jobLocation(node)),
        description: formatJobDescription(typeof node.description === "string" ? node.description : ""),
        source: "structured",
      };
    }
  }
  return null;
}

function meta(html: string, property: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i",
  );
  const m = html.match(re);
  return decodeEntities((m?.[1] ?? m?.[2] ?? "").trim());
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/** Durée maximale de la récupération d'une description complète (redirections comprises). */
const DESCRIPTION_TIMEOUT_MS = 10_000;

/**
 * Description complète d'une offre lue sur sa page d'origine (données structurées
 * JobPosting), ou null si la page est inaccessible, bloque la lecture ou n'en publie pas.
 * Ne lève jamais d'erreur : sert à compléter un extrait (Adzuna, France Travail).
 */
export async function fetchOfferDescription(rawUrl: string): Promise<string | null> {
  const read = async () => {
    const { html } = await fetchHtml(rawUrl);
    return findJobPosting(html)?.description.trim() || null;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DESCRIPTION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read(), timeout]);
  } catch (error) {
    if (!(error instanceof OfferImportError)) console.error("[offer-import] description", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Longueur de texte envoyée à Claude : largement suffisante pour une offre complète. */
const AI_PAGE_TEXT_LIMIT = 40_000;

function pageTitle(html: string) {
  return meta(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? "");
}

/** Conditions (contrat, télétravail…) en tête, puis description et profil : pas de colonnes dédiées. */
function composeDescription(fields: OfferFields) {
  const facts = [
    fields.contract_type && `Contrat : ${fields.contract_type}`,
    fields.remote && `Télétravail : ${fields.remote.replace(/^télétravail\s*:?\s*/i, "")}`,
    fields.salary && `Salaire : ${fields.salary}`,
    fields.experience && `Expérience : ${fields.experience}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    facts,
    fields.description?.trim() && `Descriptif du poste\n${fields.description.trim()}`,
    fields.profile?.trim() && `Profil recherché\n${fields.profile.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function extractWithAi(
  text: string,
  source: "ai" | "jina" | "text",
  url?: string,
): Promise<ImportedOffer | null> {
  const fields = await extractOfferFields(text.slice(0, AI_PAGE_TEXT_LIMIT), url);
  if (!fields || !(fields.position || fields.company)) return null;
  return {
    position: fields.position?.trim() ?? "",
    company: fields.company?.trim() ?? "",
    location: fields.location?.trim() ?? "",
    description: composeDescription(fields),
    source,
  };
}

export async function importOfferFromUrl(rawUrl: string): Promise<ImportedOffer> {
  // Lien invalide ou réseau privé : refusé d'emblée, sans passer par Jina.
  await assertPublicUrl(rawUrl);

  // 1. Lecture directe de la page ; en cas d'échec (site qui bloque, trop lent…), Jina prend le relais.
  let page: { html: string; finalUrl: string } | null = null;
  try {
    page = await fetchHtml(rawUrl);
  } catch (error) {
    if (error instanceof OfferImportError && error.kind === "not_found") throw error;
  }

  if (page) {
    // 2. Données structurées schema.org (Welcome to the Jungle, Indeed, la plupart des ATS…)
    const structured = findJobPosting(page.html);
    if (structured && (structured.position || structured.company)) return structured;
    if (isNotFoundTitle(pageTitle(page.html))) throw new OfferImportError(NOT_FOUND_MESSAGE, "not_found");
  }

  // 3. Extraction par Claude : contenu rendu par Jina, à défaut texte de la page lue directement
  if (isClaudeConfigured()) {
    const gate = await checkAiRateLimit();
    if (!gate.ok) throw new OfferImportError(gate.message);

    let jinaText = "";
    try {
      jinaText = await fetchViaJina(rawUrl);
    } catch (error) {
      if (error instanceof OfferImportError && error.kind === "not_found") throw error;
      if (!(error instanceof OfferImportError)) console.error("[offer-import] Jina", error);
    }

    if (jinaText.length > 200) {
      const offer = await extractWithAi(jinaText, "jina", rawUrl);
      if (offer) return offer;
    } else if (page) {
      const pageText = htmlToText(page.html.replace(/<head[\s\S]*?<\/head>/i, " "));
      if (pageText.length > 200) {
        const offer = await extractWithAi(
          `Titre de la page : ${pageTitle(page.html)}\n\n${pageText}`,
          "ai",
          page.finalUrl,
        );
        if (offer) return offer;
      }
    }
  }

  // 4. Dernier recours : balises meta
  if (!page) throw new OfferImportError("Impossible de lire cette page.");
  const ogTitle = pageTitle(page.html);
  if (!ogTitle) throw new OfferImportError("Aucune information trouvée sur cette page.");
  // og:site_name désigne souvent le site d'emploi, pas l'entreprise : on ne l'utilise pas.
  return {
    position: ogTitle,
    company: "",
    location: "",
    description: "",
    source: "meta",
  };
}

/** Texte d'offre collé par l'utilisateur quand la page n'a pas pu être lue. */
export async function importOfferFromText(text: string): Promise<ImportedOffer> {
  if (!isClaudeConfigured()) throw new OfferImportError("L'analyse automatique n'est pas activée.");
  const gate = await checkAiRateLimit();
  if (!gate.ok) throw new OfferImportError(gate.message);

  const offer = await extractWithAi(text, "text");
  if (!offer) throw new OfferImportError("Aucune information d'offre trouvée dans ce texte.");
  // Sans description extraite, le texte collé tient lieu de description.
  return { ...offer, description: offer.description || text.trim() };
}
