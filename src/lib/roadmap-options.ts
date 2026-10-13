// Roadmap produit (/admin/roadmap) : statuts et catégories, partagés entre le serveur et
// les composants. Alignés avec la migration 0021 (contraintes de la table roadmap_items).

export const ROADMAP_STATUSES = ["a_faire", "en_cours", "termine"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_CATEGORIES = ["court_terme", "moyen_terme", "long_terme"] as const;
export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number];

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

export const ROADMAP_CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  court_terme: "Court terme",
  moyen_terme: "Moyen terme",
  long_terme: "Long terme",
};

/** Badge de statut : gris (à faire), amber (en cours), vert (terminé). */
export const ROADMAP_STATUS_STYLES: Record<RoadmapStatus, string> = {
  a_faire: "bg-slate-100 text-slate-700 ring-slate-200",
  en_cours: "bg-amber-50 text-amber-800 ring-amber-200",
  termine: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** Statut suivant au clic sur le badge : à faire → en cours → terminé → à faire. */
export function nextRoadmapStatus(status: RoadmapStatus): RoadmapStatus {
  return ROADMAP_STATUSES[(ROADMAP_STATUSES.indexOf(status) + 1) % ROADMAP_STATUSES.length];
}

export const ROADMAP_TITLE_MAX_LENGTH = 200;
export const ROADMAP_DESCRIPTION_MAX_LENGTH = 2000;

export type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  category: RoadmapCategory;
  createdAt: string;
};

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
  return typeof value === "string" && (ROADMAP_STATUSES as readonly string[]).includes(value);
}

export function isRoadmapCategory(value: unknown): value is RoadmapCategory {
  return typeof value === "string" && (ROADMAP_CATEGORIES as readonly string[]).includes(value);
}
