// Lecture groupée de la table company_domains (migration 0041) : une seule requête pour tous
// les noms affichés d'une page. Module pur (client passé en paramètre), enveloppé côté serveur
// par company-domains-store.ts.

import { legacyNameKey, nameKey } from "./company-domain";

export type CompanyDomainStatus = "verified" | "ambiguous" | "none" | "blocked";
/** `source` : « admin » (posé à la main), « logo_dev_search »… ; absente si inconnue. */
export type CompanyDomainRow = { domain: string | null; status: CompanyDomainStatus; source?: string };
/** Lignes de company_domains indexées par nameKey. */
export type CompanyDomainsTable = ReadonlyMap<string, CompanyDomainRow>;

export const EMPTY_COMPANY_DOMAINS: CompanyDomainsTable = new Map();

/** Noms lus au plus par requête (une page en affiche bien moins). */
const MAX_KEYS = 500;

/** Au-delà, la page s'affiche sans la table (initiales, logos de la liste vérifiée). */
export const READ_TIMEOUT_MS = 3_000;

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };
export type CompanyDomainsClient = {
  from(table: "company_domains"): {
    select(columns: string): { in(column: string, values: string[]): PromiseLike<QueryResult> };
  };
};

/** Promesse rejetée après `ms` millisecondes (minuterie toujours libérée). */
export async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("délai dépassé")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Clés à lire pour ces noms : clé actuelle, plus l'ancienne clé quand elle diffère (lignes
 * écrites avant le lot 2b, « banquede » pour « Banque de France »).
 */
export function keysToRead(names: (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const name of names) {
    const key = nameKey(name);
    if (key.length < 2) continue;
    keys.add(key);
    const legacy = legacyNameKey(name);
    if (legacy !== key && legacy.length >= 2) keys.add(legacy);
  }
  return [...keys].slice(0, MAX_KEYS);
}

/**
 * Ligne de la clé actuelle, sinon ligne écrite sous l'ancienne clé dont le nom affiché donne
 * cette clé actuelle (jamais la ligne d'une autre entreprise : « Air » n'est pas « Air France »).
 */
export function pickRow<T extends { name_key: string; display_name?: string | null }>(
  rows: readonly T[],
  name: string | null | undefined,
): T | null {
  const key = nameKey(name);
  if (key.length < 2) return null;
  const current = rows.find((row) => row.name_key === key);
  if (current) return current;
  const legacy = legacyNameKey(name);
  if (legacy === key) return null;
  return rows.find((row) => row.name_key === legacy && nameKey(row.display_name) === key) ?? null;
}

/**
 * Lecteur qui renvoie une table vide (initiales, logos de la liste vérifiée) si la lecture
 * échoue ou dépasse READ_TIMEOUT_MS, par exemple tant que la migration 0041 n'est pas lancée,
 * et ne journalise qu'une seule fois par instance (code d'erreur seulement, jamais de secret).
 */
export function makeCompanyDomainsReader(log: (message: string) => void, { timeoutMs = READ_TIMEOUT_MS } = {}) {
  let logged = false;
  return async function read(client: CompanyDomainsClient, names: (string | null | undefined)[]): Promise<CompanyDomainsTable> {
    const keys = keysToRead(names);
    if (keys.length === 0) return EMPTY_COMPANY_DOMAINS;
    try {
      const { data, error } = await withTimeout(
        client.from("company_domains").select("name_key, display_name, domain, status, source").in("name_key", keys),
        timeoutMs,
      );
      if (error || !Array.isArray(data)) throw new Error(error?.code ?? "réponse illisible");
      const rows = (data as { name_key?: unknown; display_name?: unknown; domain?: unknown; status?: unknown; source?: unknown }[]).flatMap((row) =>
        typeof row.name_key === "string" &&
        (row.status === "verified" || row.status === "ambiguous" || row.status === "none" || row.status === "blocked")
          ? [{
              name_key: row.name_key,
              display_name: typeof row.display_name === "string" ? row.display_name : null,
              domain: typeof row.domain === "string" ? row.domain : null,
              status: row.status as CompanyDomainStatus,
              source: typeof row.source === "string" ? row.source : null,
            }]
          : [],
      );
      const table = new Map<string, CompanyDomainRow>();
      for (const name of names) {
        const row = pickRow(rows, name);
        if (row) table.set(nameKey(name), { domain: row.domain, status: row.status, ...(row.source ? { source: row.source } : {}) });
      }
      return table;
    } catch (error) {
      if (!logged) {
        logged = true;
        const code = error instanceof Error ? error.message.slice(0, 40) : "inconnue";
        log(`[company-domains] lecture impossible (${code}) : logos de la liste vérifiée et initiales seulement`);
      }
      return EMPTY_COMPANY_DOMAINS;
    }
  };
}
