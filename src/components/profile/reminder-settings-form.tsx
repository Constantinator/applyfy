"use client";

import { useState, useTransition } from "react";

import { saveReminderSettingsAction } from "@/app/actions/profile";
import {
  FIRST_REMINDER_OPTIONS,
  SECOND_REMINDER_OPTIONS,
  type ReminderSettings,
} from "@/lib/reminders";

const selectClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400";

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
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">
            Recevoir des rappels de relance par email
          </span>
          <span className="block text-xs text-slate-500">
            Pour les candidatures « Envoyée » ou « En attente » restées sans réponse.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="first-reminder" className="text-sm font-medium text-slate-700">
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
          <label htmlFor="second-reminder" className="text-sm font-medium text-slate-700">
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
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          L&apos;envoi d&apos;emails n&apos;est pas encore configuré sur ce site : tes préférences sont
          enregistrées mais aucun rappel ne partira pour l&apos;instant.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {feedback && !pending && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`text-sm ${feedback.ok ? "text-emerald-700" : "text-rose-600"}`}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
