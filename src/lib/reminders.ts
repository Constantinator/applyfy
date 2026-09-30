// Rappels de relance : réglages et règle de déclenchement (fonctions pures, testables).

export const FIRST_REMINDER_OPTIONS = [5, 7, 10, 14] as const;
export const SECOND_REMINDER_OPTIONS = [7, 10, 14] as const;
export const MAX_REMINDERS = 2;

export type ReminderSettings = {
  enabled: boolean;
  /** Jours sans réponse avant le 1er rappel (depuis l'envoi ou le dernier contact). */
  firstDays: (typeof FIRST_REMINDER_OPTIONS)[number];
  /** Jours après le 1er rappel avant le 2e. */
  secondDays: (typeof SECOND_REMINDER_OPTIONS)[number];
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: true, firstDays: 7, secondDays: 14 };

/** Statuts « sans réponse » concernés par les rappels. */
export const REMINDER_STATUSES = ["envoyee", "en_attente"] as const;

export function isFirstReminderOption(value: number): value is ReminderSettings["firstDays"] {
  return (FIRST_REMINDER_OPTIONS as readonly number[]).includes(value);
}
export function isSecondReminderOption(value: number): value is ReminderSettings["secondDays"] {
  return (SECOND_REMINDER_OPTIONS as readonly number[]).includes(value);
}

/** Lit les réglages d'une ligne profiles (valeurs par défaut si absente ou invalide). */
export function readReminderSettings(row: {
  reminders_enabled?: boolean | null;
  first_reminder_days?: number | null;
  second_reminder_days?: number | null;
} | null): ReminderSettings {
  const first = Number(row?.first_reminder_days);
  const second = Number(row?.second_reminder_days);
  return {
    enabled: row?.reminders_enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    firstDays: isFirstReminderOption(first) ? first : DEFAULT_REMINDER_SETTINGS.firstDays,
    secondDays: isSecondReminderOption(second) ? second : DEFAULT_REMINDER_SETTINGS.secondDays,
  };
}

export type ReminderCandidate = {
  status: string;
  applied_at: string | null;
  last_contact_at: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jours entiers écoulés entre une date (YYYY-MM-DD ou ISO) et maintenant. */
export function daysBetween(from: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(from).getTime()) / DAY_MS);
}

/**
 * Numéro du rappel à envoyer aujourd'hui (1 ou 2), ou null si rien à envoyer.
 * - 1er rappel : `firstDays` jours sans réponse depuis l'envoi (ou le dernier contact) ;
 * - 2e rappel : `secondDays` jours après le 1er rappel ;
 * - jamais plus de MAX_REMINDERS par candidature.
 */
export function dueReminder(app: ReminderCandidate, settings: ReminderSettings, now: Date): 1 | 2 | null {
  if (!settings.enabled) return null;
  if (!(REMINDER_STATUSES as readonly string[]).includes(app.status)) return null;
  if (!app.applied_at) return null;

  if (app.reminders_sent === 0) {
    const since = app.last_contact_at ?? app.applied_at;
    return daysBetween(since, now) >= settings.firstDays ? 1 : null;
  }
  if (app.reminders_sent === 1 && app.last_reminder_at) {
    return daysBetween(app.last_reminder_at, now) >= settings.secondDays ? 2 : null;
  }
  return null;
}
