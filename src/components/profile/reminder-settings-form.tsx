"use client";

import { useState, useTransition } from "react";

import { saveReminderSettingsAction } from "@/app/actions/profile";
import {
  FIRST_REMINDER_OPTIONS,
  SECOND_REMINDER_OPTIONS,
  type ReminderSettings,
} from "@/lib/reminders";

const selectClassName =
  "ui-input py-2";

export function ReminderSettingsForm({
  initial,
  emailEnabled,
}: {
  initial: ReminderSettings;
  /** L'envoi d'emails est configuré côté serveur (Brevo). */
  emailEnabled: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    settings.enabled !== saved.enabled ||
    settings.firstDays !== saved.firstDays ||
    settings.secondDays !== saved.secondDays;

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveReminderSettingsAction(settings);
      if (result.ok) {
        setSaved(settings);
        setFeedback({ ok: true, text: result.message });
      } else {
        setFeedback({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>
          <span className="block text-sm font-medium text-ink dark:text-white">
            Recevoir des rappels de relance par email
          </span>
          <span className="block text-xs text-muted dark:text-slate-400">
            Pour les candidatures « Envoyée » ou « En attente » restées sans réponse.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="first-reminder" className="text-sm font-medium text-ink dark:text-slate-200">
            Premier rappel
          </label>
          <select
            id="first-reminder"
            value={settings.firstDays}
            disabled={!settings.enabled}
            onChange={(e) =>
              setSettings({ ...settings, firstDays: Number(e.target.value) as ReminderSettings["firstDays"] })
            }
            className={`${selectClassName} w-full`}
          >
            {FIRST_REMINDER_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} jours après l&apos;envoi
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="second-reminder" className="text-sm font-medium text-ink dark:text-slate-200">
            Deuxième rappel
          </label>
          <select
            id="second-reminder"
            value={settings.secondDays}
            disabled={!settings.enabled}
            onChange={(e) =>
              setSettings({ ...settings, secondDays: Number(e.target.value) as ReminderSettings["secondDays"] })
            }
            className={`${selectClassName} w-full`}
          >
            {SECOND_REMINDER_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} jours après le premier
              </option>
            ))}
          </select>
        </div>
      </div>

      {!emailEnabled && (
        <p className="ui-notice px-3 py-2 text-xs">
          L&apos;envoi d&apos;emails n&apos;est pas encore configuré sur ce site : tes préférences sont
          enregistrées mais aucun rappel ne partira pour l&apos;instant.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="ui-btn-primary"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {feedback && !pending && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`text-sm ${feedback.ok ? "text-ink dark:text-slate-200" : "text-red-600 dark:text-red-400"}`}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
