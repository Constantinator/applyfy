"use client";

import { STATUS_STYLES } from "@/components/status-badge";
import { APPLICATION_STATUSES, RESPONSE_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

/**
 * Statut d'une candidature du dashboard, modifiable sur place : badge de statut avec un
 * <select> natif transparent par-dessus (sélecteur du téléphone sur mobile). Placé au-dessus
 * du lien qui rend la carte ou la ligne cliquable (z-10) : le clic n'ouvre pas la fiche.
 */
export function StatusSelect({
  status,
  company,
  error,
  onChange,
}: {
  status: ApplicationStatus;
  company: string;
  /** Message d'erreur du dernier changement, affiché sous le badge. */
  error?: string;
  onChange: (status: ApplicationStatus) => void;
}) {
  const style = STATUS_STYLES[status];
  return (
    <div className="relative z-10 inline-flex flex-col items-end gap-1 md:items-start" onClick={(e) => e.stopPropagation()}>
      <span
        className={`relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset transition-shadow has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-accent hover:brightness-95 ${style.badge}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {STATUS_LABELS[status]}
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="-mr-0.5 h-3.5 w-3.5 opacity-70">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
        <select
          aria-label={`Statut de la candidature ${company}`}
          value={status}
          onChange={(e) => onChange(e.target.value as ApplicationStatus)}
          // Mobile : zone de 44 px de haut, plus grande que le badge (invisible).
          className="absolute inset-x-0 top-1/2 h-11 w-full -translate-y-1/2 cursor-pointer appearance-none opacity-0 md:top-0 md:h-full md:translate-y-0"
        >
          {APPLICATION_STATUSES.filter((s) => !RESPONSE_STATUSES.includes(s)).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
          <optgroup label="Réponse reçue">
            {RESPONSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </optgroup>
        </select>
      </span>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-red-600 md:text-left dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
