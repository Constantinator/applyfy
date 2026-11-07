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
  a_venir: "bg-pill text-muted ring-line",
  a_faire: "bg-ink text-white ring-ink",
  soumis: "bg-pill text-ink ring-line",
  en_retard: "bg-[#FEF2F2] text-[#B91C1C] ring-[#FECACA]",
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
    <form onSubmit={submit} className="mt-3 space-y-4 rounded-block bg-surface p-4 ring-1 ring-line">
      {def.fields.map((field) => {
        const id = `beta-${def.number}-${field.name}`;
        if (field.kind === "text") {
          return (
            <div key={field.name} className="space-y-1.5">
              <label htmlFor={id} className="text-sm font-medium text-ink">
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
                className="ui-input bg-white"
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
            <legend className="text-sm font-medium text-ink">{field.label}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {options.map(([value, label]) => {
                const parsed = field.kind === "rating10" ? Number(value) : value;
                const selected = answers[field.name] === parsed;
                return (
                  <label
                    key={value}
                    className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm ring-1 lg:min-h-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                      selected ? "bg-ink font-medium text-white ring-ink" : "bg-white text-ink ring-line hover:bg-surface"
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
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? "Envoi…" : `Envoyer le ${def.title.toLowerCase()}`}
        </button>
        <p className="text-xs text-muted">Un rapport envoyé ne peut plus être modifié.</p>
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
    <ol>
      {BETA_REPORTS.map((def) => {
        const report = submitted.find((r) => r.number === def.number);
        const status = reportStatus(joinedAt, def.number, report?.submittedAt ?? null, now);
        const deadline = reportDeadline(joinedAt, def.number);
        return (
          <li key={def.number} className="border-t border-line-soft py-4 first:border-t-0 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">
                  {def.title} · {def.period}
                </h3>
                <p className="mt-0.5 text-[13px] text-muted">
                  {def.fields.map((f) => f.label.toLowerCase()).join(", ")}
                </p>
                <p className="mt-1 text-[13px] text-muted">
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
                className="ui-btn-primary mt-3"
              >
                Remplir le {def.title.toLowerCase()}
              </button>
            )}
            {status === "a_faire" && active && openForm === def.number && (
              <ReportForm def={def} onDone={() => setOpenForm(null)} />
            )}

            {report && (
              <dl className="mt-3 space-y-2 border-t border-line-soft pt-3 text-sm">
                {def.fields.map((field) => (
                  <div key={field.name}>
                    <dt className="text-xs font-medium text-muted">{field.label}</dt>
                    <dd className="whitespace-pre-line text-ink">{formatAnswer(field, report.answers[field.name])}</dd>
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
