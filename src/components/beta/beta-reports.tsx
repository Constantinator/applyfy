"use client";

import { useState, useTransition } from "react";

import { submitBetaReportAction } from "@/app/actions/beta";
import {
  BETA_RECOMMEND_OPTIONS,
  BETA_REPORT_STATUS_LABELS,
  BETA_REPORTS,
  BETA_TEXT_MAX_LENGTH,
  formatAnswer,
  reportDeadline,
  reportOpensAt,
  reportStatus,
  type BetaReportAnswers,
  type BetaReportDefinition,
  type BetaReportStatus,
} from "@/lib/beta-rules";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

const STATUS_STYLES: Record<BetaReportStatus, string> = {
  a_venir: "bg-slate-100 text-slate-600 ring-slate-200",
  a_faire: "bg-blue-50 text-blue-700 ring-blue-200",
  soumis: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  en_retard: "bg-red-50 text-red-700 ring-red-200",
};

function ReportForm({ def, onDone }: { def: BetaReportDefinition; onDone: () => void }) {
  const [answers, setAnswers] = useState<BetaReportAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: string, value: string | number) => setAnswers((a) => ({ ...a, [name]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitBetaReportAction(def.number, answers);
      if (result.ok) onDone();
      else setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      {def.fields.map((field) => {
        const id = `beta-${def.number}-${field.name}`;
        if (field.kind === "text") {
          return (
            <div key={field.name} className="space-y-1.5">
              <label htmlFor={id} className="text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <textarea
                id={id}
                rows={4}
                required={field.required}
                maxLength={BETA_TEXT_MAX_LENGTH}
                placeholder={field.placeholder}
                value={String(answers[field.name] ?? "")}
                onChange={(e) => set(field.name, e.target.value)}
                className="input bg-white"
              />
            </div>
          );
        }
        const options =
          field.kind === "rating10"
            ? Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)] as const)
            : Object.entries(BETA_RECOMMEND_OPTIONS);
        return (
          <fieldset key={field.name}>
            <legend className="text-sm font-medium text-slate-700">{field.label}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {options.map(([value, label]) => {
                const parsed = field.kind === "rating10" ? Number(value) : value;
                const selected = answers[field.name] === parsed;
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
                      selected ? "bg-blue-600 font-medium text-white ring-blue-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={id}
                      value={value}
                      checked={selected}
                      onChange={() => set(field.name, parsed)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
          {pending ? "Envoi…" : `Envoyer le ${def.title.toLowerCase()}`}
        </button>
        <p className="text-xs text-slate-500">Un rapport envoyé ne peut plus être modifié.</p>
      </div>
    </form>
  );
}

/**
 * Section « Mes rapports beta » (page Beta testing) : les 3 rapports, leur date limite et leur
 * statut ; formulaire du rapport en cours, réponses des rapports envoyés.
 */
export function BetaReports({
  joinedAt,
  active,
  submitted,
}: {
  joinedAt: string;
  /** Accès beta actif (sinon : consultation seule). */
  active: boolean;
  submitted: { number: number; submittedAt: string; answers: BetaReportAnswers }[];
}) {
  const [openForm, setOpenForm] = useState<number | null>(null);
  const now = new Date();

  return (
    <ol className="space-y-3">
      {BETA_REPORTS.map((def) => {
        const report = submitted.find((r) => r.number === def.number);
        const status = reportStatus(joinedAt, def.number, report?.submittedAt ?? null, now);
        const deadline = reportDeadline(joinedAt, def.number);
        return (
          <li key={def.number} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-slate-900">
                  {def.title} · {def.period}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {def.fields.map((f) => f.label.toLowerCase()).join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {status === "soumis" && report
                    ? `Envoyé le ${dateFormatter.format(new Date(report.submittedAt))}`
                    : status === "a_venir"
                      ? `Ouvre le ${dateFormatter.format(reportOpensAt(joinedAt, def.number))} · à envoyer avant le ${dateFormatter.format(deadline)}`
                      : `À envoyer avant le ${dateFormatter.format(deadline)}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[status]}`}>
                {BETA_REPORT_STATUS_LABELS[status]}
              </span>
            </div>

            {status === "a_faire" && active && openForm !== def.number && (
              <button
                type="button"
                onClick={() => setOpenForm(def.number)}
                className="btn-primary mt-3 px-4 py-2 text-sm"
              >
                Remplir le {def.title.toLowerCase()}
              </button>
            )}
            {status === "a_faire" && active && openForm === def.number && (
              <ReportForm def={def} onDone={() => setOpenForm(null)} />
            )}

            {report && (
              <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
                {def.fields.map((field) => (
                  <div key={field.name}>
                    <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
                    <dd className="whitespace-pre-line text-slate-700">{formatAnswer(field, report.answers[field.name])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}
