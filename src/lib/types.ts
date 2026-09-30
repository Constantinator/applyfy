export const APPLICATION_STATUSES = [
  "brouillon",
  "envoyee",
  "en_attente",
  "relancee",
  "entretien",
  "offre",
  "refusee",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Statuts « réponse reçue » (regroupés dans le sélecteur de statut). */
export const RESPONSE_STATUSES: ApplicationStatus[] = ["entretien", "offre", "refusee"];

export type Application = {
  id: string;
  company: string;
  position: string;
  location: string | null;
  offer_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  last_contact_at: string | null;
  created_at: string;
};

export type ApplicationDetail = Application & {
  offer_description: string | null;
  /** Résumé généré par l'assistant (migration 0004). */
  offer_summary?: string | null;
  /** Suggestions d'adaptation du CV (migration 0005). */
  /** JSON brut (ancien ou nouveau format) : à lire avec readCvSuggestions(). */
  cv_suggestions?: unknown;
  cv_suggestions_at?: string | null;
  /** CV amélioré, HTML nettoyé (migration 0006). */
  cv_improved_html?: string | null;
  cv_improved_at?: string | null;
  /** Personnalisation du CV amélioré, JSON brut : à lire avec readCvStyle() (migration 0009). */
  cv_improved_style?: unknown;
  notes: string | null;
};

export type ApplicationEventType =
  | "creation"
  | "envoi"
  | "relance"
  | "reponse"
  | "changement_statut"
  | "note"
  | "rappel";

export type ApplicationEvent = {
  id: string;
  application_id: string;
  type: ApplicationEventType;
  content: string | null;
  created_at: string;
};

export type DocumentKind = "cv" | "lettre_motivation";

export type ApplicationDocument = {
  id: string;
  application_id: string;
  kind: DocumentKind;
  file_name: string;
  storage_path: string | null;
  content: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  en_attente: "En attente",
  relancee: "Relancée",
  entretien: "Entretien",
  offre: "Offre reçue",
  refusee: "Refusée",
};

export const EVENT_LABELS: Record<ApplicationEventType, string> = {
  creation: "Candidature créée",
  envoi: "Candidature envoyée",
  relance: "Relance",
  reponse: "Réponse reçue",
  changement_statut: "Statut modifié",
  note: "Note",
  rappel: "Rappel de relance envoyé",
};

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  cv: "CV",
  lettre_motivation: "Lettre de motivation",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}
