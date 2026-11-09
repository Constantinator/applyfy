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
import { SUCCESS_PILL } from "@/lib/ui-tints";

const LINK_CLASS =
  "ui-link inline-flex min-h-11 items-center text-sm";

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
      <label htmlFor="weekly-goal" className="text-sm font-medium text-ink dark:text-slate-200">
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
          className="ui-input min-h-11 w-24"
        />
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="ui-btn-secondary">
          Annuler
        </button>
        {goal !== null && (
          <button type="button" onClick={() => save("")} disabled={pending} className={LINK_CLASS}>
            Retirer l&apos;objectif
          </button>
        )}
      </div>
      {error && (
        <p id="weekly-goal-error" role="alert" className="ui-notice-error mt-2 px-3 py-2 text-sm">
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
    <section aria-labelledby="week-title" className="ui-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="week-title" className="ui-title">
          Ma semaine
        </h2>
        <div role="group" aria-label="Période" className="flex rounded-full bg-pill p-1 dark:bg-slate-800">
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
              className={`ui-focus ui-hit relative rounded-full px-3.5 py-1.5 text-[13px] leading-[18px] font-semibold whitespace-nowrap transition max-[359px]:px-2 ${
                period === id
                  ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                  : "text-muted hover:text-ink dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-[44px] leading-none font-bold tracking-[-0.04em] text-ink dark:text-white">
        {sentThisWeek}
        {goal !== null && <span className="text-[22px] font-semibold tracking-normal text-muted dark:text-slate-400"> / {goal}</span>}
        <span className="ml-2 text-[15px] font-normal tracking-normal text-muted dark:text-slate-300">
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
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-track dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] dark:bg-blue-500"
            style={{ width: `${goalPercent(sentThisWeek, goal)}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted dark:text-slate-300">
        {goal !== null && sentThisWeek >= goal && <span className={SUCCESS_PILL}>Objectif tenu</span>}
        <p>{weekMessage(sentThisWeek, goal)}</p>
        {goalEditable && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={LINK_CLASS}>
            {goal === null ? "Fixer un objectif" : "Modifier l'objectif"}
          </button>
        )}
      </div>
      {goalEditable && editing && <GoalForm goal={goal} onClose={() => setEditing(false)} />}

      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {(
          [
            ["Envoyées", shown.sent],
            ["Réponses", shown.responses],
            ["Entretiens", shown.interviews],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-block bg-[#F8F8F8] px-3 py-3.5 max-[359px]:px-2 sm:px-4 dark:bg-slate-800/50"
          >
            <dt className="text-xs text-muted dark:text-slate-300">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold text-ink dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {shown.responseRate !== null && (
        <p className="mt-3 text-sm text-muted dark:text-slate-300">
          Taux de réponse :{" "}
          <strong className="font-semibold text-ink dark:text-white">{shown.responseRate} %</strong>
        </p>
      )}
    </section>
  );
}
