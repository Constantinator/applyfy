// « À faire aujourd'hui » du tableau de bord (fonctions pures, testables). La règle de relance
// est celle de la stat et du filtre « À relancer » (follow-up.ts), jamais dupliquée ici.
import { daysSince, needsFollowUp } from "./follow-up";
import type { Application } from "./types";

/** Lignes affichées avant « Voir les autres » : 4, ou 3 sur mobile. */
export const TODO_MAX_LINES = 4;
export const TODO_MAX_LINES_MOBILE = 3;

export type TodoItem = {
  kind: "relance" | "brouillon";
  id: string;
  company: string;
  position: string;
  /** Relance : délai affiché sous le titre. */
  delay: string | null;
};

const inDays = (days: number) => `il y a ${days} jour${days > 1 ? "s" : ""}`;

/** Jour d'une date (YYYY-MM-DD ou ISO) : l'envoi et le dernier contact n'ont pas le même format. */
const dayOf = (date: string) => date.slice(0, 10);

/** « envoyée il y a X jours », ou « dernier contact il y a X jours » si un contact a suivi l'envoi. */
export function followUpDelay(app: Application, now: Date): string | null {
  const contact = app.last_contact_at;
  const applied = app.applied_at;
  if (contact && (!applied || dayOf(contact) > dayOf(applied))) {
    return `dernier contact ${inDays(daysSince(contact, now) ?? 0)}`;
  }
  return applied ? `envoyée ${inDays(daysSince(applied, now) ?? 0)}` : null;
}

/** Actions du jour : relances puis brouillons, les plus anciens d'abord. Jamais la candidature exemple. */
export function buildTodo(applications: Application[], now: Date): TodoItem[] {
  const real = applications.filter((app) => !app.is_example);
  const waitingSince = (app: Application) => new Date(app.last_contact_at ?? app.applied_at ?? 0).getTime();
  const relances = real
    .filter((app) => needsFollowUp(app, now))
    .sort((a, b) => waitingSince(a) - waitingSince(b))
    .map((app): TodoItem => ({
      kind: "relance",
      id: app.id,
      company: app.company,
      position: app.position,
      delay: followUpDelay(app, now),
    }));
  const drafts = real
    .filter((app) => app.status === "brouillon")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((app): TodoItem => ({ kind: "brouillon", id: app.id, company: app.company, position: app.position, delay: null }));
  return [...relances, ...drafts];
}

/** Lignes non affichées, par type (pour « Voir les autres »). */
export function remainingTodo(items: TodoItem[], shown: number) {
  const rest = items.slice(shown);
  return {
    relances: rest.filter((item) => item.kind === "relance").length,
    drafts: rest.filter((item) => item.kind === "brouillon").length,
  };
}

/** « 3 choses » / « 1 chose » (la phrase de situation la met en gras). */
export const todoCountLabel = (count: number) => `${count} chose${count > 1 ? "s" : ""} à faire aujourd'hui`;

/** Date du jour en français, à l'heure de Paris (le serveur tourne en UTC) : « Jeudi 5 novembre ». */
export function todayLabel(now: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
