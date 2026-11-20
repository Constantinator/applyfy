// Recherche d'une entreprise par son nom chez Logo.dev (GET api.logo.dev/v2/search), règle
// d'acceptation du résultat et calendrier des nouveaux essais. Aucun appel au modèle.
//
// La clé secrète (sk_) est passée en paramètre par l'appelant serveur (company-domains-store.ts,
// script de rattrapage) : ce module ne lit pas l'environnement, n'écrit jamais la clé dans un
// message ni un journal, et ne doit jamais être importé par un composant client.
// Doc : https://www.logo.dev/docs/api-reference/search/search-brands

import { isPlatformHost, nameKey, nameTokens, registrableDomain } from "./company-domain";

export const LOGO_DEV_SEARCH_URL = "https://api.logo.dev/v2/search";
const TIMEOUT_MS = 10_000;

export type SearchCandidate = { name: string; domain: string };

export type SearchOutcome =
  | { kind: "ok"; candidates: SearchCandidate[] }
  /** Clé absente : aucune requête envoyée. */
  | { kind: "skipped" }
  /** Arrêt de toute résolution : clé refusée (401), crédits épuisés (402), limite atteinte (429). */
  | { kind: "stop"; reason: "unauthorized" | "no_credits" | "rate_limited"; status: number }
  /** Échec ponctuel (400, 5xx, réseau, réponse illisible) : rien n'est écrit, nouvel essai plus tard. */
  | { kind: "error"; reason: "bad_request" | "server" | "network" | "invalid_response"; status: number | null };

type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

/** Recherche Logo.dev par nom (10 meilleurs candidats). Ne lève jamais d'exception. */
export async function searchLogoDev(
  name: string,
  { secretKey, fetchImpl = fetch as unknown as FetchLike }: { secretKey: string | null | undefined; fetchImpl?: FetchLike },
): Promise<SearchOutcome> {
  if (!secretKey) return { kind: "skipped" };
  const params = new URLSearchParams({ q: name.trim().slice(0, 200), limit: "10", method: "match" });
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(`${LOGO_DEV_SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: "error", reason: "network", status: null };
  }
  const { status } = response;
  if (status === 401 || status === 403) return { kind: "stop", reason: "unauthorized", status };
  if (status === 402) return { kind: "stop", reason: "no_credits", status };
  if (status === 429) return { kind: "stop", reason: "rate_limited", status };
  if (status >= 500) return { kind: "error", reason: "server", status };
  if (!response.ok) return { kind: "error", reason: "bad_request", status };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error", reason: "invalid_response", status };
  }
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return { kind: "error", reason: "invalid_response", status };
  const candidates = data.flatMap((item): SearchCandidate[] => {
    const { name: candidateName, domain } = (item ?? {}) as { name?: unknown; domain?: unknown };
    return typeof candidateName === "string" && typeof domain === "string" && candidateName.trim() && domain.trim()
      ? [{ name: candidateName.trim(), domain: domain.trim() }]
      : [];
  });
  return { kind: "ok", candidates };
}

/** Seuls suffixes tolérés entre le nom cherché et le candidat : « ING Bank » ↔ « ING ». Jamais group / groupe. */
const TOLERATED_SUFFIXES: ReadonlySet<string> = new Set(["bank", "banque"]);

export type AcceptRule = "same_key" | "bank_suffix";

/** Comment un candidat correspond au nom cherché, ou null. */
export function matchRule(query: string, candidate: string): AcceptRule | null {
  const q = nameTokens(query);
  const c = nameTokens(candidate);
  const qKey = q.join("");
  const cKey = c.join("");
  if (qKey.length < 2 || cKey.length < 2) return null;
  if (qKey === cKey) return "same_key";
  const withoutSuffix = (tokens: string[]) =>
    tokens.length >= 2 && TOLERATED_SUFFIXES.has(tokens[tokens.length - 1]) ? tokens.slice(0, -1).join("") : null;
  if (withoutSuffix(q) === cKey || withoutSuffix(c) === qKey) return "bank_suffix";
  return null;
}

export type Acceptance =
  | { status: "verified"; domain: string; candidate: SearchCandidate; rule: AcceptRule }
  | { status: "ambiguous"; competing: SearchCandidate[] }
  | { status: "none" };

/**
 * Règle d'acceptation : parmi les candidats dont le nom correspond (même nameKey, ou différence
 * d'un seul mot bank / banque), et dont le domaine est un domaine principal valide hors
 * plateformes, un seul domaine distinct → verified ; plusieurs → ambiguous (initiales) ; aucun →
 * none. Un candidat qui ne correspond pas n'est jamais retenu, même en tête de liste.
 */
export function acceptSearch(query: string, candidates: SearchCandidate[]): Acceptance {
  const matching: (SearchCandidate & { rule: AcceptRule })[] = [];
  for (const candidate of candidates) {
    const rule = matchRule(query, candidate.name);
    const domain = registrableDomain(candidate.domain.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]);
    if (!rule || !domain || isPlatformHost(domain)) continue;
    matching.push({ name: candidate.name, domain, rule });
  }
  const domains = [...new Set(matching.map((candidate) => candidate.domain))];
  if (domains.length === 0) return { status: "none" };
  if (domains.length > 1) {
    const competing = domains.map((domain) => {
      const first = matching.find((candidate) => candidate.domain === domain)!;
      return { name: first.name, domain };
    });
    return { status: "ambiguous", competing };
  }
  const best = matching.find((candidate) => candidate.rule === "same_key") ?? matching[0];
  return { status: "verified", domain: best.domain, candidate: { name: best.name, domain: best.domain }, rule: best.rule };
}

const DAY = 86_400_000;

/**
 * Date du prochain essai après un résultat, ou null (plus d'essai automatique) :
 * none → 7, 14 puis 28 jours, 4 essais au plus ; ambiguous → 30 jours, 2 essais au plus.
 * `attempts` : nombre d'essais, celui-ci compris.
 */
export function nextTryAt(status: Acceptance["status"], attempts: number, now: Date): Date | null {
  if (status === "none" && attempts < 4) return new Date(now.getTime() + 7 * DAY * 2 ** (attempts - 1));
  if (status === "ambiguous" && attempts < 2) return new Date(now.getTime() + 30 * DAY);
  return null;
}

/** Paramètres de la fonction SQL upsert_company_domain (migration 0041) pour un résultat. */
export function upsertParams(displayName: string, acceptance: Acceptance, attempts: number, now: Date) {
  const next = nextTryAt(acceptance.status, attempts, now);
  return {
    p_name_key: nameKey(displayName),
    p_display_name: displayName.trim().slice(0, 200),
    p_domain: acceptance.status === "verified" ? acceptance.domain : null,
    p_status: acceptance.status,
    p_next_try_at: next ? next.toISOString() : null,
  };
}
