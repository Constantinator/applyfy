import "server-only";

// Client de l'API « Offres d'emploi v2 » de France Travail (francetravail.io).
// Authentification OAuth2 « client credentials » : un jeton d'accès (≈ 25 min) est
// obtenu avec FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET et gardé en mémoire.

const TOKEN_URL =
  process.env.FRANCE_TRAVAIL_TOKEN_URL ??
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const API_URL =
  process.env.FRANCE_TRAVAIL_API_URL ?? "https://api.francetravail.io/partenaire/offresdemploi/v2";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

/** Taille d'une page de résultats. */
export const OFFERS_PAGE_SIZE = 20;
/** L'API ne renvoie pas d'offres au-delà de l'index 1149. */
const MAX_INDEX = 1149;

export function isFranceTravailConfigured() {
  return Boolean(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET);
}

export class FranceTravailError extends Error {}

// ---------------------------------------------------------------------------
// Jeton d'accès
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

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
  if (!response.ok) {
    console.error("[france-travail] jeton refusé", response.status, await response.text().catch(() => ""));
    throw new FranceTravailError("Connexion à France Travail impossible (identifiants refusés).");
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new FranceTravailError("Réponse inattendue de France Travail.");
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
    throw new FranceTravailError("Trop de recherches en ce moment. Réessaie dans quelques secondes.");
  }
  return response;
}

// ---------------------------------------------------------------------------
// Référentiels (codes officiels des filtres), mis en cache 24 h
// ---------------------------------------------------------------------------

export type ReferenceItem = { code: string; libelle: string };

async function getReference(name: "naturesContrats" | "secteursActivites"): Promise<ReferenceItem[]> {
  const response = await apiGet(`/referentiel/${name}`, { revalidate: 86_400 });
  if (!response.ok) throw new FranceTravailError("Chargement des filtres impossible.");
  return ((await response.json()) as ReferenceItem[]).filter((item) => item.code && item.libelle);
}

export async function getSectors(): Promise<ReferenceItem[]> {
  const sectors = await getReference("secteursActivites");
  return sectors.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

/** Types de contrat proposés dans les filtres. */
export const CONTRACT_FILTERS = {
  cdi: "CDI",
  cdd: "CDD",
  alternance: "Alternance",
  stage: "Stage",
} as const;
export type ContractFilter = keyof typeof CONTRACT_FILTERS;

export function isContractFilter(value: unknown): value is ContractFilter {
  return typeof value === "string" && value in CONTRACT_FILTERS;
}

export type OfferSearch = {
  keywords: string;
  /** Code de département (ex. « 75 », « 2A »), déjà résolu depuis la saisie. */
  department: string | null;
  contract: ContractFilter | null;
  sector: string | null;
  page: number;
};

export type OfferSummary = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  publishedAt: string | null;
  contract: string | null;
};

/** Profil recherché, tel que décrit par les champs structurés de l'offre. */
export type OfferProfile = {
  experience: string | null;
  formations: string[];
  /** Compétences ; `required` : exigée (sinon souhaitée). */
  skills: { label: string; required: boolean }[];
  qualities: string[];
  languages: string[];
  licences: string[];
};

/** Offre complète, pour la liste des résultats et le panneau de détails. */
export type OfferListing = OfferSummary & {
  /** Page publique de l'offre sur France Travail. */
  url: string;
  description: string;
  salary: string | null;
  workingHours: string | null;
  experience: string | null;
  sector: string | null;
  companyDescription: string | null;
  profile: OfferProfile;
};

export type OfferSearchResult = { offers: OfferListing[]; total: number };

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
  title: offer.intitule?.trim() || "Offre sans intitulé",
  company: offer.entreprise?.nom?.trim() || null,
  location: offer.lieuTravail?.libelle?.trim() || null,
  publishedAt: offer.dateCreation ?? null,
  contract: offer.alternance ? "Alternance" : (offer.typeContratLibelle?.trim() || offer.typeContrat || null),
});

const clean = (value: string | undefined) => value?.trim() || null;
const labels = (items: { libelle?: string }[] | undefined) =>
  (items ?? []).map((item) => clean(item.libelle)).filter((label): label is string => Boolean(label));

function toListing(offer: RawOffer): OfferListing {
  const salary = [offer.salaire?.libelle, offer.salaire?.commentaire, offer.salaire?.complement1, offer.salaire?.complement2]
    .map(clean)
    .filter(Boolean)
    .join(" · ");
  return {
    ...toSummary(offer),
    url:
      offer.origineOffre?.urlOrigine ||
      `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(offer.id)}`,
    description: offer.description?.trim() ?? "",
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

export async function searchOffers(search: OfferSearch): Promise<OfferSearchResult> {
  const start = Math.min((search.page - 1) * OFFERS_PAGE_SIZE, MAX_INDEX);
  const params = new URLSearchParams({
    range: `${start}-${Math.min(start + OFFERS_PAGE_SIZE - 1, MAX_INDEX)}`,
    // 0 : pertinence (avec mots-clés), 1 : plus récentes d'abord.
    sort: search.keywords ? "0" : "1",
  });
  let keywords = search.keywords;
  if (search.department) params.set("departement", search.department);
  if (search.sector) params.set("secteurActivite", search.sector);

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

  const response = await apiGet(`/offres/search?${params}`);
  if (response.status === 204) return { offers: [], total: 0 };
  if (!response.ok) {
    console.error("[france-travail] recherche", response.status, await response.text().catch(() => ""));
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

export function isOfferId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9]{1,20}$/.test(id);
}

/** Une offre par son identifiant ; null si elle n'existe plus. */
export async function getOfferListing(id: string): Promise<OfferListing | null> {
  if (!isOfferId(id)) return null;
  const response = await apiGet(`/offres/${encodeURIComponent(id)}`);
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) {
    console.error("[france-travail] offre", response.status);
    throw new FranceTravailError("Impossible de récupérer cette offre. Réessaie dans un instant.");
  }
  return toListing((await response.json()) as RawOffer);
}

export type OfferDetail = OfferSummary & { url: string; description: string };

/** Offre au format d'une candidature : description + informations clés (lib/format-offer). */
export async function getOffer(id: string): Promise<OfferDetail | null> {
  const offer = await getOfferListing(id);
  if (!offer) return null;

  const details = [
    offer.contract && `• Contrat : ${offer.contract}`,
    offer.workingHours && `• Durée du travail : ${offer.workingHours}`,
    offer.salary && `• Salaire : ${offer.salary}`,
    offer.experience && `• Expérience : ${offer.experience}`,
    offer.sector && `• Secteur : ${offer.sector}`,
  ].filter(Boolean);
  const description = [
    offer.description,
    details.length ? `## Informations clés\n${details.join("\n")}` : null,
    offer.companyDescription ? `## L'entreprise\n${offer.companyDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { ...offer, description };
}
