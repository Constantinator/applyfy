import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { daysSince, needsFollowUp } from "@/lib/applications";
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

function lastContactLabel(app: Application) {
  const days = daysSince(app.last_contact_at ?? app.applied_at);
  if (days === null) return "Pas encore envoyée";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function FollowUpButton({ app }: { app: Application }) {
  const due = needsFollowUp(app);
  return (
    <Link
      href={`/candidatures/${app.id}#relance`}
      className={`relative z-10 inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
        due
          ? "bg-amber-500 text-white shadow-sm hover:bg-amber-400"
          : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      Relancer
    </Link>
  );
}

export function ApplicationsList({ applications }: { applications: Application[] }) {
  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-medium text-slate-900">Aucune candidature ici</p>
        <p className="mt-1 text-sm text-slate-500">
          Ajoute ta première candidature pour commencer le suivi.
        </p>
        <Link
          href="/candidatures/nouvelle"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + Nouvelle candidature
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
            className="relative rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-indigo-500"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/candidatures/${app.id}`}
                className="min-w-0 after:absolute after:inset-0 after:rounded-xl focus:outline-none"
              >
                <p className="truncate font-medium text-slate-900">{app.company}</p>
                <p className="truncate text-sm text-slate-500">{app.position}</p>
              </Link>
              <StatusBadge status={app.status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                <p>Envoyée : {formatDate(app.applied_at)}</p>
                <p className={needsFollowUp(app) ? "font-medium text-amber-700" : ""}>
                  Dernier contact : {lastContactLabel(app)}
                </p>
              </div>
              <FollowUpButton app={app} />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Entreprise / Poste</th>
              <th scope="col" className="px-4 py-3">Statut</th>
              <th scope="col" className="px-4 py-3">Date d&apos;envoi</th>
              <th scope="col" className="px-4 py-3">Dernier contact</th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.map((app) => (
              <tr
                key={app.id}
                className="group relative cursor-pointer hover:bg-slate-50 has-[a:focus-visible]:bg-indigo-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/candidatures/${app.id}`}
                    className="block after:absolute after:inset-0 focus:outline-none"
                  >
                    <p className="font-medium text-slate-900 group-hover:text-indigo-600">
                      {app.company}
                    </p>
                    <p className="text-slate-500">
                      {app.position}
                      {app.location && <span className="text-slate-400"> · {app.location}</span>}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(app.applied_at)}</td>
                <td
                  className={`px-4 py-3 ${
                    needsFollowUp(app) ? "font-medium text-amber-700" : "text-slate-600"
                  }`}
                >
                  {lastContactLabel(app)}
                </td>
                <td className="px-4 py-3 text-right">
                  <FollowUpButton app={app} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
