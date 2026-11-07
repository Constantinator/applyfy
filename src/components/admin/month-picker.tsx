"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « octobre 2026 » à partir de « 2026-10 ». */
function formatMonth(month: string) {
  return monthName.format(new Date(`${month}-01T00:00:00Z`));
}

/** Lien vers /admin pour un mois ; le mois en cours n'a pas de paramètre. */
const hrefFor = (month: string, current: string) => (month === current ? "/admin" : `/admin?mois=${month}`);

/**
 * Sélecteur du mois affiché par le tableau de bord admin (paramètre ?mois=YYYY-MM).
 * `months` : mois consultables, du plus récent (mois en cours) au plus ancien.
 */
export function MonthPicker({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const current = months[0];
  const index = months.indexOf(month);
  const newer = index > 0 ? months[index - 1] : null;
  const older = index < months.length - 1 ? months[index + 1] : null;

  const arrow = "ui-btn-secondary w-11 shrink-0 px-0!";
  const disabledArrow = `${arrow} pointer-events-none opacity-40`;

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      {older ? (
        <Link href={hrefFor(older, current)} className={arrow} aria-label={`Mois précédent : ${formatMonth(older)}`}>
          ←
        </Link>
      ) : (
        <span className={disabledArrow} aria-hidden="true">
          ←
        </span>
      )}
      <label htmlFor="admin-mois" className="sr-only">
        Mois affiché
      </label>
      <select
        id="admin-mois"
        value={month}
        onChange={(event) => router.push(hrefFor(event.target.value, current))}
        className="ui-input min-w-0 flex-1 py-2 pr-8 text-sm font-medium capitalize sm:w-auto sm:flex-none"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonth(m)}
            {m === current ? " (en cours)" : ""}
          </option>
        ))}
      </select>
      {newer ? (
        <Link href={hrefFor(newer, current)} className={arrow} aria-label={`Mois suivant : ${formatMonth(newer)}`}>
          →
        </Link>
      ) : (
        <span className={disabledArrow} aria-hidden="true">
          →
        </span>
      )}
    </div>
  );
}
