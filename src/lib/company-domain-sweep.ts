// Passage hebdomadaire (cron du dimanche, app/api/cron/domaines) : nouveaux essais de résolution
// des domaines d'entreprises. D'abord les lignes dues de company_domains (none après 7, 14 puis
// 28 jours ; ambiguous après 30 jours), puis les noms de candidatures absents de la table (tâche
// de fond after() échouée ou plafond atteint). 50 noms au plus par passage, arrêt immédiat sur
// 401/402/429 et sur plafond. Chaque nom passe par resolveCompanyDomain (même règle, mêmes
// plafonds, même seule écriture). Module pur : client, clé et fetch passés en paramètres.
//
// Le bilan ne contient que des nombres : ni nom d'entreprise, ni identifiant d'utilisateur.

import { PLACEHOLDER_NAME_KEYS, nameKey } from "./company-domain";
import { isDue, resolveCompanyDomain, DB_TIMEOUT_MS, type DomainRowState, type ResolveDeps } from "./company-domain-resolve";
import { keysToRead, pickRow, withTimeout } from "./company-domains-read";

/** Noms recherchés au plus par passage. */
export const SWEEP_MAX_NAMES = 50;
/** Lignes de candidatures lues au plus pour trouver les noms absents de la table. */
const MAX_APPLICATION_ROWS = 20_000;
const PAGE = 1_000;
/** Erreurs ponctuelles (base, réseau) tolérées avant d'arrêter le passage. */
const MAX_ERRORS = 5;

type Result = { data: unknown; error: { code?: string; message?: string } | null };
type Query = PromiseLike<Result> & {
  in(column: string, values: string[]): Query;
  lte(column: string, value: string): Query;
  not(column: string, operator: string, value: null): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  range(from: number, to: number): Query;
};
/** Sous-ensemble du client Supabase (service_role) lu par le passage. */
export type SweepClient = { from(table: "company_domains" | "applications"): { select(columns: string): Query } };

export type SweepReport = {
  dryRun: boolean;
  due: number;
  missing: number;
  selected: number;
  searched: number;
  written: { verified: number; ambiguous: number; none: number };
  skipped: number;
  errors: number;
  stopped: string | null;
  error: string | null;
};

const code = (error: unknown) =>
  (error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : error instanceof Error ? error.message : "inconnue").slice(0, 40);

async function query(q: PromiseLike<Result>): Promise<unknown[]> {
  const { data, error } = await withTimeout(q, DB_TIMEOUT_MS);
  if (error || !Array.isArray(data)) throw error ?? new Error("réponse illisible");
  return data;
}

/** Noms dus (lignes none / ambiguous dont la date de nouvel essai est passée), les plus anciens d'abord. */
async function dueNames(client: SweepClient, now: Date, max: number): Promise<string[]> {
  const rows = (await query(
    client
      .from("company_domains")
      .select("name_key, display_name, status, source, attempts, next_try_at")
      .in("status", ["none", "ambiguous"])
      .lte("next_try_at", now.toISOString())
      .order("next_try_at", { ascending: true })
      .limit(max),
  )) as DomainRowState[];
  return rows.filter((row) => isDue(row, now) && row.display_name).map((row) => row.display_name as string);
}

/** Noms de candidatures absents de la table (ni clé actuelle, ni ancienne clé reprise), variante la plus fréquente. */
async function missingNames(client: SweepClient, known: ReadonlyMap<string, string>, max: number): Promise<string[]> {
  const byKey = new Map<string, Map<string, number>>();
  for (let from = 0; from < MAX_APPLICATION_ROWS; from += PAGE) {
    const rows = (await query(
      client.from("applications").select("company").not("company", "is", null).order("created_at", { ascending: false }).range(from, from + PAGE - 1),
    )) as { company?: unknown }[];
    for (const row of rows) {
      const name = typeof row.company === "string" ? row.company.trim() : "";
      const key = nameKey(name);
      if (key.length < 2 || key.length > 120 || PLACEHOLDER_NAME_KEYS.has(key) || known.has(key)) continue;
      const variants = byKey.get(key) ?? new Map<string, number>();
      variants.set(name, (variants.get(name) ?? 0) + 1);
      byKey.set(key, variants);
    }
    if (rows.length < PAGE) break;
  }
  const names = [...byKey.values()].map((variants) => [...variants].sort((a, b) => b[1] - a[1])[0][0]);
  const missing: string[] = [];
  for (let i = 0; i < names.length && missing.length < max; i += 100) {
    const chunk = names.slice(i, i + 100);
    const rows = (await query(
      client.from("company_domains").select("name_key, display_name").in("name_key", keysToRead(chunk)),
    )) as { name_key: string; display_name: string | null }[];
    for (const name of chunk) if (!pickRow(rows, name) && missing.length < max) missing.push(name);
  }
  return missing;
}

/**
 * Un passage : sélection (lignes dues, puis noms absents), puis résolution nom par nom.
 * `dryRun` : sélection seulement, aucune recherche ni écriture. Ne lève jamais d'exception.
 */
export async function runDomainSweep({
  client,
  dryRun = false,
  max = SWEEP_MAX_NAMES,
  ...deps
}: Omit<ResolveDeps, "client"> & { client: SweepClient; dryRun?: boolean; max?: number }): Promise<SweepReport> {
  const now = deps.now ?? new Date();
  const report: SweepReport = {
    dryRun, due: 0, missing: 0, selected: 0, searched: 0,
    written: { verified: 0, ambiguous: 0, none: 0 }, skipped: 0, errors: 0, stopped: null, error: null,
  };
  const limit = Math.min(Math.max(0, max), SWEEP_MAX_NAMES);
  let selected: string[];
  try {
    const due = await dueNames(client, now, limit);
    const missing = due.length < limit ? await missingNames(client, deps.known, limit - due.length) : [];
    report.due = due.length;
    report.missing = missing.length;
    const byKey = new Map<string, string>();
    for (const name of [...due, ...missing]) if (!byKey.has(nameKey(name))) byKey.set(nameKey(name), name);
    selected = [...byKey.values()].slice(0, limit);
    report.selected = selected.length;
  } catch (error) {
    report.error = `sélection impossible (${code(error)})`;
    deps.log(`[cron/domaines] ${report.error}`);
    return report;
  }
  if (dryRun) return report;

  for (const name of selected) {
    const outcome = await resolveCompanyDomain(name, { ...deps, client: client as unknown as ResolveDeps["client"], now });
    if (outcome.kind === "written") {
      report.searched++;
      report.written[outcome.status]++;
    } else if (outcome.kind === "stop") {
      report.searched++;
      report.stopped = `${outcome.reason} ${outcome.status}`;
      break;
    } else if (outcome.kind === "skipped") {
      if (outcome.reason === "cap" || outcome.reason === "no_key") {
        report.stopped = outcome.reason === "cap" ? "plafond" : "clé absente";
        break;
      }
      report.skipped++;
    } else {
      report.errors++;
      if (report.errors >= MAX_ERRORS) {
        report.stopped = "trop d'erreurs";
        break;
      }
    }
  }
  return report;
}
