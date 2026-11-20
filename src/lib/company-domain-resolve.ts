// Résolution du domaine d'UNE entreprise par la recherche Logo.dev, lancée en tâche de fond après
// la création d'une candidature (company-domains-store.ts, via after()) et réutilisée par le script
// de rattrapage (règle « dû ou pas » identique). Module pur : client Supabase, clé et fetch passés
// en paramètres. Ne lève jamais d'exception ; journaux sans secret (motif et code HTTP seulement).
//
// Règle d'acceptation inchangée (acceptSearch) : verified, ambiguous (initiales) ou none.
// Seule écriture : la fonction SQL upsert_company_domain, qui n'écrase jamais admin ni blocked.

import { PLACEHOLDER_NAME_KEYS, legacyNameKey, nameKey } from "./company-domain";
import { pickRow, withTimeout } from "./company-domains-read";
import { acceptSearch, searchLogoDev, upsertParams, type SearchOutcome } from "./logo-dev-search";

/** Recherches Logo.dev au plus par jour (toutes personnes confondues), comptées sur la table. */
export const DAILY_SEARCH_CAP = 300;
/** Plafond mensuel, très loin des 500 000 requêtes gratuites. */
export const MONTHLY_SEARCH_CAP = 5_000;
/** Délai maximal de chaque lecture ou écriture en base. */
export const DB_TIMEOUT_MS = 5_000;

export type DomainRowState = {
  name_key: string;
  display_name: string | null;
  status: string;
  source: string;
  attempts: number;
  next_try_at: string | null;
};

/** Une recherche est due : nom jamais cherché, ou none / ambiguous dont la date de nouvel essai est passée. */
export function isDue(row: Pick<DomainRowState, "status" | "source" | "next_try_at"> | null | undefined, now: Date): boolean {
  if (!row) return true;
  return (
    row.source !== "admin" &&
    (row.status === "none" || row.status === "ambiguous") &&
    row.next_try_at !== null &&
    new Date(row.next_try_at) <= now
  );
}

type Result<T = unknown> = { data: T | null; error: { code?: string; message?: string } | null; count?: number | null };

/** Sous-ensemble du client Supabase utilisé (service_role). */
export type ResolveClient = {
  from(table: "company_domains"): {
    select(columns: string, options?: { count: "exact"; head: true }): {
      in(column: string, values: string[]): PromiseLike<Result>;
      eq(column: string, value: string): { gte(column: string, value: string): PromiseLike<Result> };
    };
  };
  rpc(fn: "upsert_company_domain", params: ReturnType<typeof upsertParams>): PromiseLike<Result>;
};

export type ResolveOutcome =
  | { kind: "skipped"; reason: "no_key" | "invalid_name" | "known" | "not_due" | "cap" }
  | { kind: "written"; status: "verified" | "ambiguous" | "none" }
  | { kind: "stop"; reason: string; status: number }
  | { kind: "error"; reason: string };

export type ResolveDeps = {
  client: ResolveClient;
  secretKey: string | null | undefined;
  /** Noms de la liste vérifiée (nameKey) : jamais recherchés. */
  known: ReadonlyMap<string, string>;
  log: (message: string) => void;
  now?: Date;
  fetchImpl?: Parameters<typeof searchLogoDev>[1]["fetchImpl"];
  /** Plafonds (le passage du dimanche peut en donner d'autres). */
  caps?: { daily: number; monthly: number };
};

const errorCode = (error: unknown) =>
  (error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : error instanceof Error ? error.message : "inconnue").slice(0, 40);

/** Recherches lancées depuis cette date (lignes logo_dev_search mises à jour depuis). */
async function searchesSince(client: ResolveClient, since: Date): Promise<number> {
  const { count, error } = await withTimeout(
    client.from("company_domains").select("name_key", { count: "exact", head: true }).eq("source", "logo_dev_search").gte("updated_at", since.toISOString()),
    DB_TIMEOUT_MS,
  );
  if (error || typeof count !== "number") throw error ?? new Error("comptage illisible");
  return count;
}

/**
 * Cherche le domaine de cette entreprise et écrit le résultat, si la recherche est due et que les
 * plafonds le permettent. Ne lève jamais d'exception.
 */
export async function resolveCompanyDomain(name: string, deps: ResolveDeps): Promise<ResolveOutcome> {
  const { client, secretKey, known, log } = deps;
  const now = deps.now ?? new Date();
  const caps = deps.caps ?? { daily: DAILY_SEARCH_CAP, monthly: MONTHLY_SEARCH_CAP };
  try {
    if (!secretKey) return { kind: "skipped", reason: "no_key" };
    const displayName = name.trim().slice(0, 200);
    const key = nameKey(displayName);
    if (key.length < 2 || key.length > 120 || PLACEHOLDER_NAME_KEYS.has(key)) return { kind: "skipped", reason: "invalid_name" };
    if (known.has(key)) return { kind: "skipped", reason: "known" };

    const keys = [...new Set([key, legacyNameKey(displayName)].filter((k) => k.length >= 2))];
    const { data, error } = await withTimeout(
      client.from("company_domains").select("name_key, display_name, status, source, attempts, next_try_at").in("name_key", keys),
      DB_TIMEOUT_MS,
    );
    if (error || !Array.isArray(data)) throw error ?? new Error("réponse illisible");
    const row = pickRow(data as DomainRowState[], displayName);
    if (!isDue(row, now)) return { kind: "skipped", reason: "not_due" };

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if ((await searchesSince(client, startOfDay)) >= caps.daily || (await searchesSince(client, startOfMonth)) >= caps.monthly) {
      log("[company-domains] plafond de recherches Logo.dev atteint : nom laissé pour plus tard");
      return { kind: "skipped", reason: "cap" };
    }

    const outcome: SearchOutcome = await searchLogoDev(displayName, { secretKey, fetchImpl: deps.fetchImpl });
    if (outcome.kind === "skipped") return { kind: "skipped", reason: "no_key" };
    if (outcome.kind === "stop" || outcome.kind === "error") {
      log(`[company-domains] recherche Logo.dev interrompue (${outcome.reason}${outcome.status ? ` ${outcome.status}` : ""}) : rien n'est écrit`);
      return outcome.kind === "stop"
        ? { kind: "stop", reason: outcome.reason, status: outcome.status }
        : { kind: "error", reason: outcome.reason };
    }

    const acceptance = acceptSearch(displayName, outcome.candidates);
    const attempts = (row?.name_key === key ? row.attempts : 0) + 1;
    const { error: writeError } = await withTimeout(
      client.rpc("upsert_company_domain", upsertParams(displayName, acceptance, attempts, now)),
      DB_TIMEOUT_MS,
    );
    if (writeError) throw writeError;
    return { kind: "written", status: acceptance.status };
  } catch (error) {
    log(`[company-domains] résolution impossible (${errorCode(error)}) : rien n'est écrit`);
    return { kind: "error", reason: errorCode(error) };
  }
}
