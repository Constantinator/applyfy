// Carte « Ma semaine » du tableau de bord (fonctions pures, testables) : semaine du lundi au
// dimanche et mois à l'heure de Paris, candidature exemple toujours exclue.
import { z } from "zod";

import { INTERVIEW_EVENT_SUFFIX, RESPONSE_STATUSES, type Application, type ApplicationEvent } from "./types";

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 50;
/** Taux de réponse affiché à partir de ce nombre d'envois sur la période. */
export const RESPONSE_RATE_MIN_SENT = 10;

export const PERIODS = [
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "total", label: "Au total" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export type ResponseEvent = Pick<ApplicationEvent, "application_id" | "content" | "created_at">;
export type PeriodStats = { sent: number; responses: number; interviews: number; responseRate: number | null };

const DAY = 86_400_000;
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Jour (YYYY-MM-DD) d'un instant, à l'heure de Paris. */
export const parisDay = (date: Date) => parisDate.format(date);

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Lundi et dimanche de la semaine en cours à Paris. */
export function weekBounds(now: Date) {
  const today = Date.parse(`${parisDay(now)}T00:00:00Z`);
  const fromMonday = (new Date(today).getUTCDay() + 6) % 7;
  return { from: isoDay(today - fromMonday * DAY), to: isoDay(today + (6 - fromMonday) * DAY) };
}

/** Premier et dernier jour du mois en cours à Paris. */
export function monthBounds(now: Date) {
  const [year, month] = parisDay(now).split("-").map(Number);
  return { from: isoDay(Date.UTC(year, month - 1, 1)), to: isoDay(Date.UTC(year, month, 0)) };
}

type Bounds = { from: string; to: string } | null;

function statsFor(applications: Application[], events: ResponseEvent[], bounds: Bounds): PeriodStats {
  const real = applications.filter((app) => !app.is_example);
  const realIds = new Set(real.map((app) => app.id));
  const realEvents = events.filter((event) => realIds.has(event.application_id));
  const inPeriod = (day: string) => !bounds || (day >= bounds.from && day <= bounds.to);

  const sent = real.filter((app) => app.status !== "brouillon" && app.applied_at && inPeriod(app.applied_at.slice(0, 10)));

  const eventsInPeriod = realEvents.filter((event) => inPeriod(parisDay(new Date(event.created_at))));
  const responses = new Set(eventsInPeriod.map((event) => event.application_id));
  const interviews = new Set(
    eventsInPeriod.filter((event) => event.content?.endsWith(INTERVIEW_EVENT_SUFFIX)).map((event) => event.application_id),
  );
  // Au total, le statut actuel complète l'historique (événement absent ou écrit autrement).
  if (!bounds) {
    for (const app of real) {
      if (RESPONSE_STATUSES.includes(app.status)) responses.add(app.id);
      if (app.status === "entretien") interviews.add(app.id);
    }
  }

  // Taux : part des candidatures envoyées sur la période ayant reçu une réponse, à n'importe quelle date.
  const everAnswered = new Set(realEvents.map((event) => event.application_id));
  const answered = sent.filter((app) => everAnswered.has(app.id) || RESPONSE_STATUSES.includes(app.status)).length;

  return {
    sent: sent.length,
    responses: responses.size,
    interviews: interviews.size,
    responseRate: sent.length >= RESPONSE_RATE_MIN_SENT ? Math.round((answered / sent.length) * 100) : null,
  };
}

export function buildPeriodStats(applications: Application[], events: ResponseEvent[], now: Date): Record<PeriodId, PeriodStats> {
  return {
    week: statsFor(applications, events, weekBounds(now)),
    month: statsFor(applications, events, monthBounds(now)),
    total: statsFor(applications, events, null),
  };
}

/** Remplissage de la jauge, plafonné à 100 %. */
export const goalPercent = (sent: number, goal: number) => Math.min(100, Math.round((sent / goal) * 100));

/** Phrase de la carte : jamais de reproche, même sans envoi ou loin de l'objectif. */
export function weekMessage(sent: number, goal: number | null): string {
  if (sent === 0) return "Aucun envoi pour l'instant cette semaine, à ton rythme.";
  if (goal === null) return sent > 1 ? "Belle dynamique cette semaine." : "Une candidature envoyée cette semaine, c'est lancé.";
  if (sent >= goal) return "Objectif atteint, bravo !";
  return `Encore ${goal - sent} pour atteindre ton objectif, à ton rythme.`;
}

const WeeklyGoalSchema = z.coerce
  .number()
  .int()
  .min(WEEKLY_GOAL_MIN)
  .max(WEEKLY_GOAL_MAX);

/** Objectif saisi : un entier de 1 à 50, null si le champ est vide (objectif retiré), ou un message d'erreur. */
export function parseWeeklyGoal(value: unknown): { ok: true; goal: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return { ok: true, goal: null };
  // Chiffres seuls : la conversion de zod accepterait aussi true, [5], « 1e1 » ou « 0x10 ».
  const parsed = WeeklyGoalSchema.safeParse(typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? value.trim() : NaN);
  return parsed.success
    ? { ok: true, goal: parsed.data }
    : { ok: false, error: `Choisis un nombre entier entre ${WEEKLY_GOAL_MIN} et ${WEEKLY_GOAL_MAX}.` };
}
