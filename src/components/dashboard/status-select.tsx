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
    <div className="relative z-10 inline-flex flex-col items-start gap-1 sm:items-end" onClick={(e) => e.stopPropagation()}>
      <span
        className={`relative inline-flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-3 text-[13px] leading-[18px] font-semibold whitespace-nowrap transition-shadow has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-accent hover:brightness-95 ${style.badge}`}
      >
        {STATUS_LABELS[status]}
        <span aria-hidden="true" className="text-[10px]">▾</span>
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
        <p role="alert" className="ui-notice-error max-w-48 rounded-lg px-2 py-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
