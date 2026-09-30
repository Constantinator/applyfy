import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { daysSince, needsFollowUp } from "@/lib/follow-up";
import type { Application } from "@/lib/types";

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

function FollowUpButton({ app, now }: { app: Application; now: Date }) {
  const due = needsFollowUp(app, now);
  return (
    <Link
      href={`/candidatures/${app.id}#relance`}
      className={`relative z-10 ${
        due
          ? "inline-flex items-center justify-center rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
          : "btn-secondary px-3 py-1.5 text-sm"
      }`}
    >
      Relancer
    </Link>
  );
}

export function ApplicationsList({
  applications,
  now,
}: {
  applications: Application[];
  /** Date de référence commune au serveur et au client (évite les écarts d'hydratation). */
  now: Date;
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="font-medium text-slate-900">Aucune candidature ici</p>
        <p className="mt-1 text-sm text-slate-500">
          Ajoute ta première candidature pour commencer le suivi.
        </p>
        <Link
          href="/candidatures/nouvelle"
          className="btn-primary mt-4 px-4 py-2 text-sm"
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
            className="card relative p-4 transition-colors hover:border-blue-300 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-blue-500"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/candidatures/${app.id}`}
                className="min-w-0 after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
              >
                <p className="truncate font-medium text-slate-900">{app.company}</p>
                <p className="truncate text-sm text-slate-500">{app.position}</p>
              </Link>
              <StatusBadge status={app.status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <p>Envoyée : {formatDate(app.applied_at)}</p>
                <p className={needsFollowUp(app, now) ? "font-medium text-amber-700" : ""}>
                  Dernier contact : {lastContactLabel(app, now)}
                </p>
              </div>
              <FollowUpButton app={app} now={now} />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop : tableau */}
      <div className="hidden card overflow-hidden md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-5 py-3.5">Entreprise / Poste</th>
              <th scope="col" className="px-5 py-3.5">Statut</th>
              <th scope="col" className="px-5 py-3.5">Date d&apos;envoi</th>
              <th scope="col" className="px-5 py-3.5">Dernier contact</th>
              <th scope="col" className="px-5 py-3.5 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.map((app) => (
              <tr
                key={app.id}
                className="group relative cursor-pointer transition-colors hover:bg-blue-50/40 has-[a:focus-visible]:bg-blue-50"
              >
                <td className="px-5 py-4">
                  <Link
                    href={`/candidatures/${app.id}`}
                    className="flex items-center gap-3 after:absolute after:inset-0 focus:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-sm font-bold text-blue-700 ring-1 ring-blue-100"
                    >
                      {app.company.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 group-hover:text-blue-600">
                        {app.company}
                      </span>
                      <span className="block text-slate-500">
                        {app.position}
                        {app.location && <span className="text-slate-400"> · {app.location}</span>}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-5 py-4 text-slate-600">{formatDate(app.applied_at)}</td>
                <td
                  className={`px-5 py-4 ${
                    needsFollowUp(app, now) ? "font-medium text-amber-700" : "text-slate-600"
                  }`}
                >
                  {lastContactLabel(app, now)}
                </td>
                <td className="px-5 py-4 text-right">
                  <FollowUpButton app={app} now={now} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
