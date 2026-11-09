import Link from "next/link";

import { SectorPill } from "@/components/sector-pill";
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

function formatDate(date: string) {
  return dateFormatter.format(new Date(date));
}

/** « il y a 4 jours », ou null sans date connue. */
function lastContactLabel(app: Application, now: Date) {
  const days = daysSince(app.last_contact_at ?? app.applied_at, now);
  if (days === null) return null;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
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
        <Link href="/candidatures/nouvelle" className="ui-btn-primary mt-4">
          Ajouter une candidature
        </Link>
      </div>
    );
  }

  return (
    <ul className="ui-card px-4 py-2 sm:px-6">
      {applications.map((app) => {
        const contact = lastContactLabel(app, now);
        return (
          <li
            key={app.id}
            className="group relative flex flex-col items-start gap-x-4 gap-y-2 border-t border-line-soft px-1 py-[18px] first:border-t-0 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
          >
            <Link
              href={`/candidatures/${app.id}`}
              className="min-w-0 flex-1 after:absolute after:inset-0 focus:outline-none"
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink group-hover:text-accent dark:text-white dark:group-hover:text-blue-300">
                <span className="truncate">{app.company}</span>
                {app.is_example && <ExampleBadge />}
                <SectorPill sector={app.sector} />
              </span>
              <span className="mt-0.5 block text-[13px] break-words text-muted dark:text-slate-400">
                {[app.position, app.location].filter(Boolean).join(" · ")}
                {" · "}
                {app.applied_at ? `envoyée le ${formatDate(app.applied_at)}` : "pas encore envoyée"}
                {contact && (
                  <>
                    {" · "}
                    <span className={needsFollowUp(app, now) ? "font-medium text-late dark:text-amber-300" : ""}>
                      dernier contact {contact}
                    </span>
                  </>
                )}
              </span>
            </Link>
            <StatusSelect status={app.status} company={app.company} error={errors[app.id]} onChange={(status) => onStatusChange(app, status)} />
          </li>
        );
      })}
    </ul>
  );
}

/** Badge discret de la candidature exemple créée à l'inscription. */
function ExampleBadge() {
  return (
    <span className="shrink-0 rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase ring-1 ring-line dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">Exemple</span>
  );
}
