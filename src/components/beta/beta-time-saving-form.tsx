"use client";

import { useState, useTransition } from "react";

import { saveTimeSavingAction } from "@/app/actions/beta";
import {
  TIME_SAVING_MAX_MINUTES,
  TIME_SAVING_MIN_MINUTES,
  floorPercent,
  gainPercent,
  type TimeSavingAnswer,
} from "@/lib/beta-time-saving";
import { BETA_TIME_TEXTS as T } from "@/lib/lumeo-texts";

/** Phrase de Lumeo sur le gain de la personne, calculé à partir de ses propres réponses. */
function gainSentence(answer: TimeSavingAnswer) {
  const percent = floorPercent(gainPercent(answer));
  if (answer.after > answer.before) return T.negative;
  if (percent <= 0) return T.noGain;
  return T.gain(percent);
}

function MinutesField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          required
          min={TIME_SAVING_MIN_MINUTES}
          max={TIME_SAVING_MAX_MINUTES}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ui-input w-28 bg-white"
        />
        <span className="text-sm text-muted">{T.unit}</span>
      </div>
    </div>
  );
}

/** « Ton temps par candidature » : deux réponses en minutes, modifiables. */
export function BetaTimeSavingForm({ initial }: { initial: TimeSavingAnswer | null }) {
  const [before, setBefore] = useState(initial ? String(initial.before) : "");
  const [after, setAfter] = useState(initial ? String(initial.after) : "");
  // Dernière réponse enregistrée : la phrase de gain la suit, pas la saisie en cours.
  const [saved, setSaved] = useState<TimeSavingAnswer | null>(initial);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setJustSaved(false);
    startTransition(async () => {
      const result = await saveTimeSavingAction({ before, after });
      if (result.ok) {
        setSaved({ before: Number(before), after: Number(after) });
        setJustSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">{T.help}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <MinutesField id="time-before" label={T.before} value={before} onChange={setBefore} />
        <MinutesField id="time-after" label={T.after} value={after} onChange={setAfter} />
      </div>
      {error && (
        <p role="alert" className="ui-notice-error px-4 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? T.saving : T.save}
        </button>
        <p role="status" className="text-sm text-ink">
          {justSaved ? T.saved : ""}
        </p>
      </div>
      {saved && <p className="text-sm font-medium text-ink">{gainSentence(saved)}</p>}
    </form>
  );
}
