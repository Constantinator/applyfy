// Règles de relance : fonctions pures, utilisables côté serveur et côté client.
import type { Application, ApplicationStatus } from "./types";

/** Délai (en jours) sans réponse après lequel une relance est suggérée. */
export const FOLLOW_UP_AFTER_DAYS = 7;

export const FOLLOW_UP_STATUSES: ApplicationStatus[] = ["envoyee", "relancee"];

/** Valeur du filtre « À relancer » du dashboard (?filtre=a_relancer). */
export const FOLLOW_UP_FILTER = "a_relancer";

export function daysSince(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const diff = now.getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function needsFollowUp(app: Application, now = new Date()): boolean {
  if (!FOLLOW_UP_STATUSES.includes(app.status)) return false;
  const days = daysSince(app.last_contact_at ?? app.applied_at, now);
  return days !== null && days >= FOLLOW_UP_AFTER_DAYS;
}
