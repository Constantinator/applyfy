// Types communs aux sources d'offres d'emploi (France Travail, Adzuna) et à la page
// « Trouver une offre ».

/** Sources d'offres, avec leur nom affiché. */
export const OFFER_SOURCES = {
  "france-travail": "France Travail",
  adzuna: "Adzuna",
} as const;
export type OfferSource = keyof typeof OFFER_SOURCES;

/** Nombre d'offres demandées à chaque source par page de résultats. */
export const SOURCE_PAGE_SIZE = 10;
/** Résultats consultables par source (France Travail s'arrête à l'index 1149). */
export const MAX_RESULTS_PER_SOURCE = 1150;
export const MAX_PAGES = MAX_RESULTS_PER_SOURCE / SOURCE_PAGE_SIZE;

/** Erreur d'une source, au message affichable tel quel. */
export class OfferSourceError extends Error {}

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
  /** Département déjà résolu depuis la saisie : code (« 75 », « 2A ») et nom. */
  department: { code: string; name: string } | null;
  contract: ContractFilter | null;
  /** Code de secteur France Travail. */
  sector: string | null;
  page: number;
};

export type OfferSummary = {
  /** Identifiant France Travail, ou « adzuna-<id> » pour Adzuna. */
  id: string;
  source: OfferSource;
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
  /** Page de l'offre originale. */
  url: string;
  description: string;
  /** La description n'est qu'un extrait (Adzuna) : le texte complet est sur l'offre originale. */
  descriptionTruncated: boolean;
  salary: string | null;
  workingHours: string | null;
  experience: string | null;
  sector: string | null;
  companyDescription: string | null;
  profile: OfferProfile;
};

export type OfferSearchResult = { offers: OfferListing[]; total: number };
