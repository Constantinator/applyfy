import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { extractOfferFields, isClaudeConfigured } from "./claude";
import { decodeEntities, formatOfferDescription } from "./format-offer";

export type ImportedOffer = {
  position: string;
  company: string;
  location: string;
  description: string;
  /** D'où viennent les infos : données structurées de la page, extraction IA ou balises meta. */
  source: "structured" | "ai" | "meta";
};

export class OfferImportError extends Error {}

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

/** Longueur de texte de page envoyée à Claude : largement suffisante pour l'en-tête d'une offre. */
const AI_PAGE_TEXT_LIMIT = 40_000;

export async function importOfferFromUrl(rawUrl: string): Promise<ImportedOffer> {
  const { html, finalUrl } = await fetchHtml(rawUrl);

  // 1. Données structurées schema.org (Welcome to the Jungle, Indeed, la plupart des ATS…)
  const structured = findJobPosting(html);
  if (structured && (structured.position || structured.company)) return structured;

  // 2. Extraction par Claude à partir du texte visible de la page
  const pageText = htmlToText(html.replace(/<head[\s\S]*?<\/head>/i, " "));
  if (isClaudeConfigured() && pageText.length > 200) {
    const title = meta(html, "og:title") || (html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "");
    const fields = await extractOfferFields(
      `Titre de la page : ${decodeEntities(title)}\n\n${pageText.slice(0, AI_PAGE_TEXT_LIMIT)}`,
      finalUrl,
    );
    if (fields && (fields.position || fields.company)) {
      return { ...fields, description: "", source: "ai" };
    }
  }

  // 3. Dernier recours : balises meta
  const ogTitle = meta(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? "");
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
