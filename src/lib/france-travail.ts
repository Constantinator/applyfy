import "server-only";

import {
  CONTRACT_FILTERS,
  OfferSourceError,
  SOURCE_PAGE_SIZE,
  type OfferListing,
  type OfferSearch,
  type OfferSearchResult,
  type OfferSummary,
} from "@/lib/offer-types";

// Client de l'API « Offres d'emploi v2 » de France Travail (francetravail.io).
// Authentification OAuth2 « client credentials » : un jeton d'accès (≈ 25 min) est
// obtenu avec FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET et gardé en mémoire.

const TOKEN_URL =
  process.env.FRANCE_TRAVAIL_TOKEN_URL ??
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const API_URL =
  process.env.FRANCE_TRAVAIL_API_URL ?? "https://api.francetravail.io/partenaire/offresdemploi/v2";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

/** L'API ne renvoie pas d'offres au-delà de l'index 1149. */
const MAX_INDEX = 1149;

export function isFranceTravailConfigured() {
  return Boolean(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET);
}

export class FranceTravailError extends OfferSourceError {}

// ---------------------------------------------------------------------------
// Jeton d'accès
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

const SECRETS = () => [process.env.FRANCE_TRAVAIL_CLIENT_ID, process.env.FRANCE_TRAVAIL_CLIENT_SECRET, cachedToken?.value];

/** En-têtes qui identifient une requête chez le fournisseur (support). */
const REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "request-id", "x-amzn-requestid", "x-amz-cf-id", "cf-ray"];

/** Réponse JSON annoncée par son type de contenu. */
const isJson = (response: Response) => /json/i.test(response.headers.get("content-type") ?? "");

/** Texte sans aucun secret : valeurs des variables d'environnement et paramètres sensibles masqués. */
function scrub(text: string, secrets: (string | null | undefined)[]): string {
  let clean = text;
  for (const secret of secrets) if (secret && secret.length >= 4) clean = clean.split(secret).join("[masqué]");
  return clean
    .replace(/((?:client_id|client_secret|access_token|app_id|app_key|token)["'=:\s]+)[^&\s"',}<]+/gi, "$1[masqué]")
    .replace(/(Bearer\s+)[^\s"',}<]+/gi, "$1[masqué]");
}

/**
 * UNE ligne de journal par échec : source et étape, statut, type de contenu, serveur, identifiant
 * de requête, 200 premiers caractères du corps (lu normalement avec text()). Jamais d'adresse ni
 * de secret. Sans nouvel essai.
 */
async function logFailure(step: string, response: Response | null, error?: unknown) {
  const secrets = SECRETS();
  if (!response) {
    const code = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
    const reason = error instanceof Error ? `${error.name}${code ? ` ${code}` : ""}` : "inconnue";
    console.error(`[france-travail] échec ${step} : réseau (${scrub(reason, secrets)})`);
    return;
  }
  const requestId = REQUEST_ID_HEADERS.map((name) => response.headers.get(name)).find(Boolean) ?? "-";
  const body = response.bodyUsed ? "" : await response.text().catch(() => "");
  console.error(
    `[france-travail] échec ${step} : statut=${response.status} type=${response.headers.get("content-type") ?? "-"} ` +
      `server=${response.headers.get("server") ?? "-"} requête=${scrub(requestId, secrets)} ` +
      `corps="${scrub(body.replace(/\s+/g, " ").trim().slice(0, 200), secrets)}"`,
  );
}

const UNEXPECTED = "Réponse inattendue de France Travail. Réessaie dans un instant.";

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FRANCE_TRAVAIL_CLIENT_ID ?? "",
      client_secret: process.env.FRANCE_TRAVAIL_CLIENT_SECRET ?? "",
      scope: SCOPE,
    }),
    cache: "no-store",
  });
  if (!response.ok || !isJson(response)) {
    // Une page HTML (page de maintenance après redirection) est une réponse inattendue.
    await logFailure("jeton", response);
    throw new FranceTravailError(
      response.ok || !isJson(response) ? UNEXPECTED : "Connexion à France Travail impossible (identifiants refusés).",
    );
  }
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!data?.access_token) throw new FranceTravailError(UNEXPECTED);
  // Marge d'une minute avant l'expiration annoncée.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 1200) - 60) * 1000 };
  return cachedToken.value;
}

async function apiGet(path: string, init?: { revalidate?: number }): Promise<Response> {
  const call = async () =>
    fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}`, Accept: "application/json" },
      ...(init?.revalidate ? { next: { revalidate: init.revalidate } } : { cache: "no-store" as const }),
    });
  let response = await call();
  if (response.status === 401) {
    // Jeton expiré ou révoqué : un nouvel essai avec un jeton neuf.
    cachedToken = null;
    response = await call();
  }
  if (response.status === 429) {
    await logFailure(path.split("?")[0], response);
    throw new FranceTravailError("Trop de recherches en ce moment. Réessaie dans quelques secondes.");
  }
  // Réponse réussie qui n'est pas du JSON (page HTML) : réponse inattendue. 204 : aucun contenu.
  if (response.ok && response.status !== 204 && !isJson(response)) {
    await logFailure(path.split("?")[0], response);
    throw new FranceTravailError(UNEXPECTED);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Référentiels (codes officiels des filtres), mis en cache 24 h
// ---------------------------------------------------------------------------

export type ReferenceItem = { code: string; libelle: string };

async function getReference(name: "naturesContrats"): Promise<ReferenceItem[]> {
  const response = await apiGet(`/referentiel/${name}`, { revalidate: 86_400 });
  if (!response.ok) {
    await logFailure("référentiel", response);
    throw new FranceTravailError("Chargement des filtres impossible.");
  }
  return ((await response.json()) as ReferenceItem[]).filter((item) => item.code && item.libelle);
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

type RawOffer = {
  id: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  dateActualisation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string; description?: string };
  typeContrat?: string;
  typeContratLibelle?: string;
  natureContrat?: string;
  experienceLibelle?: string;
  dureeTravailLibelle?: string;
  salaire?: { libelle?: string; commentaire?: string; complement1?: string; complement2?: string };
  secteurActiviteLibelle?: string;
  competences?: { libelle?: string; exigence?: string }[];
  formations?: { niveauLibelle?: string; domaineLibelle?: string; commentaire?: string; exigence?: string }[];
  qualitesProfessionnelles?: { libelle?: string }[];
  langues?: { libelle?: string; exigence?: string }[];
  permis?: { libelle?: string; exigence?: string }[];
  alternance?: boolean;
  origineOffre?: { urlOrigine?: string };
};

const toSummary = (offer: RawOffer): OfferSummary => ({
  id: offer.id,
  source: "france-travail",
  title: offer.intitule?.trim() || "Offre sans intitulé",
  company: offer.entreprise?.nom?.trim() || null,
  location: offer.lieuTravail?.libelle?.trim() || null,
  publishedAt: offer.dateCreation ?? null,
  contract: offer.alternance ? "Alternance" : (offer.typeContratLibelle?.trim() || offer.typeContrat || null),
});

const clean = (value: string | undefined) => value?.trim() || null;
const labels = (items: { libelle?: string }[] | undefined) =>
  (items ?? []).map((item) => clean(item.libelle)).filter((label): label is string => Boolean(label));

/**
 * Description visiblement coupée : terminée par « ... » / « … », ou très courte pour une
 * offre reprise d'un site partenaire (le texte complet est sur l'offre d'origine).
 */
function isTruncated(description: string, fromPartner: boolean) {
  return /(\.\.\.|…)$/.test(description) || (fromPartner && description.length < 200);
}

function toListing(offer: RawOffer): OfferListing {
  const salary = [offer.salaire?.libelle, offer.salaire?.commentaire, offer.salaire?.complement1, offer.salaire?.complement2]
    .map(clean)
    .filter(Boolean)
    .join(" · ");
  const description = offer.description?.trim() ?? "";
  return {
    ...toSummary(offer),
    url:
      offer.origineOffre?.urlOrigine ||
      `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(offer.id)}`,
    description,
    descriptionTruncated: isTruncated(description, Boolean(offer.origineOffre?.urlOrigine)),
    salary: salary || null,
    workingHours: clean(offer.dureeTravailLibelle),
    experience: clean(offer.experienceLibelle),
    sector: clean(offer.secteurActiviteLibelle),
    companyDescription: clean(offer.entreprise?.description),
    profile: {
      experience: clean(offer.experienceLibelle),
      formations: (offer.formations ?? [])
        .map((f) => [f.niveauLibelle, f.domaineLibelle, f.commentaire].map(clean).filter(Boolean).join(" — "))
        .filter(Boolean),
      skills: (offer.competences ?? [])
        .filter((c) => clean(c.libelle))
        .map((c) => ({ label: c.libelle!.trim(), required: c.exigence === "E" })),
      qualities: labels(offer.qualitesProfessionnelles),
      languages: labels(offer.langues),
      licences: labels(offer.permis),
    },
  };
}

/** Codes « nature de contrat » correspondant à un filtre (lus dans le référentiel officiel). */
async function natureCodes(pattern: RegExp): Promise<string[]> {
  const natures = await getReference("naturesContrats");
  return natures.filter((n) => pattern.test(n.libelle)).map((n) => n.code);
}

export async function searchFranceTravail(search: OfferSearch): Promise<OfferSearchResult> {
  const start = (search.page - 1) * SOURCE_PAGE_SIZE;
  // Page au-delà des résultats consultables (l'autre source peut en avoir davantage).
  if (start > MAX_INDEX) return { offers: [], total: 0 };
  // 0 : pertinence, 1 : plus récentes d'abord.
  const params = new URLSearchParams({ sort: search.sort === "pertinence" ? "0" : "1" });
  let keywords = search.keywords;
  if (search.department) params.set("departement", search.department.code);

  if (search.contract === "cdi" || search.contract === "cdd") {
    params.set("typeContrat", CONTRACT_FILTERS[search.contract]);
  } else if (search.contract === "alternance") {
    const codes = await natureCodes(/apprentissage|professionnalisation/i);
    if (codes.length) params.set("natureContrat", codes.join(","));
    else keywords = `${keywords} alternance`.trim();
  } else if (search.contract === "stage") {
    // Pas de type « stage » garanti dans l'API : nature de contrat si elle existe, sinon mot-clé.
    const codes = await natureCodes(/stage/i);
    if (codes.length) params.set("natureContrat", codes.join(","));
    else keywords = `${keywords} stage`.trim();
  }
  if (keywords) params.set("motsCles", keywords);

  if (search.sort !== "ancien") return searchRange(params, start, Math.min(start + SOURCE_PAGE_SIZE - 1, MAX_INDEX));

  // Pas de tri par date croissante dans l'API : on lit la fin des résultats triés du plus
  // récent au plus ancien, à l'envers. Au-delà de 1 150 offres, ce sont les plus anciennes
  // parmi les 1 150 plus récentes (limite de l'API).
  const { total } = await searchRange(params, 0, 0);
  const end = Math.min(total, MAX_INDEX + 1) - 1 - start;
  if (end < 0) return { offers: [], total };
  const page = await searchRange(params, Math.max(0, end - SOURCE_PAGE_SIZE + 1), end);
  return { offers: page.offers.reverse(), total };
}

/** Offres d'indices `start` à `end` (inclus) d'une recherche, et nombre total d'offres trouvées. */
async function searchRange(filters: URLSearchParams, start: number, end: number): Promise<OfferSearchResult> {
  const params = new URLSearchParams(filters);
  params.set("range", `${start}-${end}`);
  const response = await apiGet(`/offres/search?${params}`);
  // 204 : aucun résultat ; 416 : page au-delà du nombre d'offres trouvées.
  if (response.status === 204 || response.status === 416) return { offers: [], total: 0 };
  if (!response.ok) {
    await logFailure("recherche", response);
    throw new FranceTravailError(
      response.status === 400
        ? "Cette recherche n'est pas acceptée par France Travail : simplifie les mots-clés ou les filtres."
        : "Le service de France Travail ne répond pas. Réessaie dans un instant.",
    );
  }

  const data = (await response.json()) as { resultats?: RawOffer[] };
  const offers = (data.resultats ?? []).map(toListing);
  // En-tête « Content-Range: offres 0-19/1234 » : nombre total d'offres trouvées.
  const total = Number(response.headers.get("content-range")?.match(/\/(\d+)/)?.[1] ?? offers.length);
  return { offers, total };
}

// ---------------------------------------------------------------------------
// Détail d'une offre (panneau de détails, création de la candidature)
// ---------------------------------------------------------------------------

export function isFranceTravailOfferId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9]{1,20}$/.test(id);
}

/** Une offre par son identifiant ; null si elle n'existe plus. */
export async function getFranceTravailOffer(id: string): Promise<OfferListing | null> {
  if (!isFranceTravailOfferId(id)) return null;
  const response = await apiGet(`/offres/${encodeURIComponent(id)}`);
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) {
    await logFailure("offre", response);
    throw new FranceTravailError("Impossible de récupérer cette offre. Réessaie dans un instant.");
  }
  return toListing((await response.json()) as RawOffer);
}
