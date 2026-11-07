import Link from "next/link";

import { daysSince, needsFollowUp } from "@/lib/follow-up";
import type { Application, ApplicationStatus } from "@/lib/types";

import { StatusSelect } from "./status-select";

// Dates sans heure (YYYY-MM-DD) : lues comme minuit UTC, donc formatées en UTC
// pour ne pas reculer d'un jour selon le fuseau du serveur.
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string | null) {
  return date ? dateFormatter.format(new Date(date)) : "—";
}

function lastContactLabel(app: Application, now: Date) {
  const days = daysSince(app.last_contact_at ?? app.applied_at, now);
  if (days === null) return "Pas encore envoyée";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

export function ApplicationsList({
  applications,
  now,
  errors,
  onStatusChange,
}: {
  applications: Application[];
  /** Date de référence commune au serveur et au client (évite les écarts d'hydratation). */
  now: Date;
  /** Erreur du dernier changement de statut, par candidature. */
  errors: Record<string, string>;
  onStatusChange: (app: Application, status: ApplicationStatus) => void;
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
        <p className="font-medium text-ink dark:text-white">Aucune candidature ici</p>
        <p className="mt-1 text-sm text-muted dark:text-slate-400">
          Ajoute ta première candidature pour commencer le suivi.
        </p>
        <Link
          href="/candidatures/nouvelle"
          className="ui-btn-primary mt-4 px-4"
        >
          Ajouter une candidature
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Mobile : cartes */}
      <ul className="space-y-3 md:hidden">
        {applications.map((app) => (
          <li
            key={app.id}
            className="ui-card relative p-4 transition-colors hover:border-line-strong has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/candidatures/${app.id}`}
                className="min-w-0 after:absolute after:inset-0 after:rounded-card focus:outline-none"
              >
                <p className="flex items-center gap-2 font-medium text-ink dark:text-white">
                  <span className="truncate">{app.company}</span>
                  {app.is_example && <ExampleBadge />}
                </p>
                <p className="truncate text-sm text-muted dark:text-slate-400">{app.position}</p>
              </Link>
              <StatusSelect status={app.status} company={app.company} error={errors[app.id]} onChange={(status) => onStatusChange(app, status)} />
            </div>
            <div className="mt-3 text-xs text-muted dark:text-slate-400">
              <p>Envoyée : {formatDate(app.applied_at)}</p>
              <p className={needsFollowUp(app, now) ? "font-medium text-amber-700 dark:text-amber-300" : ""}>
                Dernier contact : {lastContactLabel(app, now)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop : tableau */}
      <div className="hidden ui-card overflow-hidden md:block">
        <table className="min-w-full divide-y divide-line dark:divide-slate-800 text-sm">
          <thead className="bg-surface dark:bg-slate-800/60 text-left text-xs font-semibold tracking-wide text-muted dark:text-slate-400 uppercase">
            <tr>
              <th scope="col" className="px-5 py-3.5">Entreprise / Poste</th>
              <th scope="col" className="px-5 py-3.5">Statut</th>
              <th scope="col" className="px-5 py-3.5">Date d&apos;envoi</th>
              <th scope="col" className="px-5 py-3.5">Dernier contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft dark:divide-slate-800">
            {applications.map((app) => (
              <tr
                key={app.id}
                className="group relative cursor-pointer transition-colors hover:bg-surface has-[a:focus-visible]:bg-surface has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-accent dark:hover:bg-slate-800/60 dark:has-[a:focus-visible]:bg-slate-800/60"
              >
                <td className="px-5 py-4">
                  <Link
                    href={`/candidatures/${app.id}`}
                    className="flex items-center gap-3 after:absolute after:inset-0 focus:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pill dark:bg-slate-800 text-sm font-semibold text-ink dark:text-slate-200"
                    >
                      {app.company.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-ink dark:text-white group-hover:text-accent dark:group-hover:text-blue-300">
                        {app.company}
                        {app.is_example && <ExampleBadge />}
                      </span>
                      <span className="block text-muted dark:text-slate-400">
                        {app.position}
                        {app.location && <span className="text-muted dark:text-slate-400"> · {app.location}</span>}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <StatusSelect status={app.status} company={app.company} error={errors[app.id]} onChange={(status) => onStatusChange(app, status)} />
                </td>
                <td className="px-5 py-4 text-muted dark:text-slate-300">{formatDate(app.applied_at)}</td>
                <td
                  className={`px-5 py-4 ${
                    needsFollowUp(app, now) ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted dark:text-slate-300"
                  }`}
                >
                  {lastContactLabel(app, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Badge discret de la candidature exemple créée à l'inscription. */
function ExampleBadge() {
  return (
    <span className="rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase ring-1 ring-line dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">Exemple</span>
  );
}
