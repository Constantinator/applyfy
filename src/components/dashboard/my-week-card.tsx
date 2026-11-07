"use client";

import { useState, useTransition } from "react";

import { saveWeeklyGoalAction } from "@/app/actions/dashboard";
import {
  PERIODS,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
  goalPercent,
  weekMessage,
  type PeriodId,
  type PeriodStats,
} from "@/lib/dashboard-week";

const LINK_CLASS =
  "inline-flex min-h-11 items-center text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300";

function GoalForm({ goal, onClose }: { goal: number | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value: unknown) {
    setError(null);
    startTransition(async () => {
      const result = await saveWeeklyGoalAction(value);
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save(new FormData(event.currentTarget).get("weekly_goal"));
      }}
      className="mt-3"
    >
      <label htmlFor="weekly-goal" className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Candidatures par semaine
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="weekly-goal"
          name="weekly_goal"
          type="number"
          inputMode="numeric"
          min={WEEKLY_GOAL_MIN}
          max={WEEKLY_GOAL_MAX}
          defaultValue={goal ?? ""}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "weekly-goal-error" : undefined}
          className="input min-h-11 w-24"
        />
        <button type="submit" disabled={pending} className="btn-primary min-h-11 px-4 text-sm">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="btn-secondary min-h-11 px-4 text-sm">
          Annuler
        </button>
        {goal !== null && (
          <button type="button" onClick={() => save("")} disabled={pending} className={LINK_CLASS}>
            Retirer l&apos;objectif
          </button>
        )}
      </div>
      {error && (
        <p id="weekly-goal-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Carte « Ma semaine » : envoyées cette semaine face à l'objectif facultatif, puis chiffres de la
 * période choisie. `goalEditable` : faux tant que la migration 0035 n'est pas appliquée.
 */
export function MyWeekCard({
  stats,
  goal,
  goalEditable,
}: {
  stats: Record<PeriodId, PeriodStats>;
  goal: number | null;
  goalEditable: boolean;
}) {
  const [period, setPeriod] = useState<PeriodId>("week");
  const [editing, setEditing] = useState(false);
  const sentThisWeek = stats.week.sent;
  const shown = stats[period];

  return (
    <section aria-labelledby="week-title" className="card p-5 sm:p-6">
      <h2 id="week-title" className="text-lg font-semibold text-slate-900 dark:text-white">
        Ma semaine
      </h2>

      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {sentThisWeek}
        {goal !== null && <span className="text-lg font-semibold text-slate-500 dark:text-slate-400"> / {goal}</span>}
        <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-300">
          envoyée{sentThisWeek > 1 ? "s" : ""} cette semaine
        </span>
      </p>

      {goal !== null && (
        <div
          role="progressbar"
          aria-label="Candidatures envoyées cette semaine, par rapport à ton objectif"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(sentThisWeek, goal)}
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] dark:bg-blue-500"
            style={{ width: `${goalPercent(sentThisWeek, goal)}%` }}
          />
        </div>
      )}

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{weekMessage(sentThisWeek, goal)}</p>

      {goalEditable &&
        (editing ? (
          <GoalForm goal={goal} onClose={() => setEditing(false)} />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className={LINK_CLASS}>
            {goal === null ? "Fixer un objectif" : "Modifier l'objectif"}
          </button>
        ))}

      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div role="group" aria-label="Période" className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
              className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-medium transition ${
                period === id
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {(
            [
              ["Envoyées", shown.sent],
              ["Réponses", shown.responses],
              ["Entretiens", shown.interviews],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
              <dd className="text-2xl font-bold text-slate-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>

        {shown.responseRate !== null && (
          <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-300">
            Taux de réponse :{" "}
            <strong className="font-semibold text-slate-900 dark:text-white">{shown.responseRate} %</strong>
          </p>
        )}
      </div>
    </section>
  );
}
