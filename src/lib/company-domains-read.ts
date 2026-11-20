// Lecture groupée de la table company_domains (migration 0041) : une seule requête pour tous
// les noms affichés d'une page. Module pur (client passé en paramètre), enveloppé côté serveur
// par company-domains-store.ts.

import { nameKey } from "./company-domain";

export type CompanyDomainStatus = "verified" | "ambiguous" | "none" | "blocked";
export type CompanyDomainRow = { domain: string | null; status: CompanyDomainStatus };
/** Lignes de company_domains indexées par nameKey. */
export type CompanyDomainsTable = ReadonlyMap<string, CompanyDomainRow>;

export const EMPTY_COMPANY_DOMAINS: CompanyDomainsTable = new Map();

/** Noms lus au plus par requête (une page en affiche bien moins). */
const MAX_KEYS = 500;

type QueryResult = { data: unknown; error: { code?: string; message?: string } | null };
export type CompanyDomainsClient = {
  from(table: "company_domains"): {
    select(columns: string): { in(column: string, values: string[]): PromiseLike<QueryResult> };
  };
};

/**
 * Lecteur qui renvoie une table vide (initiales, logos de la liste vérifiée) si la lecture
 * échoue, par exemple tant que la migration 0041 n'est pas lancée, et ne journalise qu'une
 * seule fois par instance (code d'erreur seulement, jamais de secret).
 */
export function makeCompanyDomainsReader(log: (message: string) => void) {
  let logged = false;
  return async function read(client: CompanyDomainsClient, names: (string | null | undefined)[]): Promise<CompanyDomainsTable> {
    const keys = [...new Set(names.map(nameKey).filter((key) => key.length >= 2))].slice(0, MAX_KEYS);
    if (keys.length === 0) return EMPTY_COMPANY_DOMAINS;
    try {
      const { data, error } = await client.from("company_domains").select("name_key, domain, status").in("name_key", keys);
      if (error || !Array.isArray(data)) throw new Error(error?.code ?? "réponse illisible");
      const table = new Map<string, CompanyDomainRow>();
      for (const row of data as { name_key?: unknown; domain?: unknown; status?: unknown }[]) {
        if (typeof row.name_key !== "string") continue;
        if (row.status !== "verified" && row.status !== "ambiguous" && row.status !== "none" && row.status !== "blocked") continue;
        table.set(row.name_key, { domain: typeof row.domain === "string" ? row.domain : null, status: row.status });
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
