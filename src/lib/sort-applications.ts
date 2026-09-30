import type { Application, ApplicationStatus } from "./types";

export const SORT_OPTIONS = [
  { value: "envoi", label: "Date d'envoi (plus récent)" },
  { value: "entreprise", label: "Entreprise (A → Z)" },
  { value: "poste", label: "Poste (A → Z)" },
  { value: "statut", label: "Statut" },
  { value: "contact", label: "Dernier contact (plus récent)" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
export const DEFAULT_SORT: SortKey = "envoi";

export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/** Tri par statut : les candidatures les plus avancées d'abord, les refus en dernier. */
const STATUS_RANK: Record<ApplicationStatus, number> = {
  offre: 0,
  entretien: 1,
  relancee: 2,
  en_attente: 3,
  envoyee: 4,
  brouillon: 5,
  refusee: 6,
};

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** Dates ISO (triables comme du texte), plus récentes d'abord, valeurs absentes à la fin. */
function recentFirst(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

const byCreatedDesc = (a: Application, b: Application) => recentFirst(a.created_at, b.created_at);

const COMPARATORS: Record<SortKey, (a: Application, b: Application) => number> = {
  envoi: (a, b) => recentFirst(a.applied_at, b.applied_at) || byCreatedDesc(a, b),
  entreprise: (a, b) =>
    collator.compare(a.company, b.company) || collator.compare(a.position, b.position),
  poste: (a, b) =>
    collator.compare(a.position, b.position) || collator.compare(a.company, b.company),
  statut: (a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] || recentFirst(a.applied_at, b.applied_at),
  contact: (a, b) =>
    recentFirst(a.last_contact_at ?? a.applied_at, b.last_contact_at ?? b.applied_at) ||
    byCreatedDesc(a, b),
};

export function sortApplications(applications: Application[], sort: SortKey): Application[] {
  return [...applications].sort(COMPARATORS[sort]);
}
