"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";

import { updateStatusAction } from "@/app/actions/applications";
import { FOLLOW_UP_FILTER, needsFollowUp } from "@/lib/follow-up";
import { DEFAULT_SORT, SORT_OPTIONS, sortApplications, type SortKey } from "@/lib/sort-applications";
import { APPLICATION_STATUSES, STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/types";

import { ApplicationsList } from "./applications-list";
import { StatusFilter, type FilterOption } from "./status-filter";

const ALL = "toutes";

/**
 * Filtre et tri côté client : instantanés, sans rechargement. L'état est reflété dans
 * l'URL (?filtre=…&tri=…) via history.replaceState, pour survivre à un rafraîchissement.
 */
export function ApplicationsView({
  applications: saved,
  nowIso,
  initialFilter,
  initialSort,
}: {
  applications: Application[];
  nowIso: string;
  initialFilter: string;
  initialSort: SortKey;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState<SortKey>(initialSort);

  // Changement de statut depuis la liste : affiché tout de suite (liste, filtres, tri), puis
  // remplacé par les données du serveur (updateStatusAction revalide /dashboard : statistiques,
  // dates d'envoi et de dernier contact). En cas d'erreur, l'ancien statut revient.
  const [applications, setOptimisticStatus] = useOptimistic(
    saved,
    (current, change: { id: string; status: ApplicationStatus }) =>
      current.map((app) => (app.id === change.id ? { ...app, status: change.status } : app)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function changeStatus(app: Application, status: ApplicationStatus) {
    if (status === app.status) return;
    const setError = (message: string | null) =>
      setErrors((prev) => {
        const next = { ...prev };
        if (message) next[app.id] = message;
        else delete next[app.id];
        return next;
      });
    setError(null);
    const formData = new FormData();
    formData.set("id", app.id);
    formData.set("status", status);
    startTransition(async () => {
      setOptimisticStatus({ id: app.id, status });
      try {
        const result = await updateStatusAction({ status: "idle" }, formData);
        if (result.status === "error") setError(result.message);
      } catch {
        setError("Le statut n'a pas pu être modifié. Réessaie.");
      }
    });
  }

  function syncUrl(next: { filtre: string; tri: SortKey }) {
    const params = new URLSearchParams(window.location.search);
    params.delete("ajout"); // messages de confirmation ponctuels
    params.delete("suppression");
    if (next.filtre === ALL) params.delete("filtre");
    else params.set("filtre", next.filtre);
    if (next.tri === DEFAULT_SORT) params.delete("tri");
    else params.set("tri", next.tri);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const filterOptions: FilterOption[] = useMemo(
    () => [
      { value: ALL, label: "Toutes", count: applications.length },
      {
        value: FOLLOW_UP_FILTER,
        label: "À relancer",
        count: applications.filter((app) => needsFollowUp(app, now)).length,
      },
      ...APPLICATION_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
        count: applications.filter((app) => app.status === status).length,
      })),
    ],
    [applications, now],
  );

  const visible = useMemo(() => {
    const filtered =
      filter === ALL
        ? applications
        : filter === FOLLOW_UP_FILTER
          ? applications.filter((app) => needsFollowUp(app, now))
          : applications.filter((app) => app.status === filter);
    return sortApplications(filtered, sort);
  }, [applications, filter, sort, now]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StatusFilter
          options={filterOptions}
          active={filter}
          onChange={(value) => {
            setFilter(value);
            syncUrl({ filtre: value, tri: sort });
          }}
        />
        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="sort" className="text-sm whitespace-nowrap text-slate-500 dark:text-slate-400">
            Trier par
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => {
              const value = e.target.value as SortKey;
              setSort(value);
              syncUrl({ filtre: filter, tri: value });
            }}
            className="input w-auto py-1.5"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} candidature{visible.length > 1 ? "s" : ""} affichée
        {visible.length > 1 ? "s" : ""}
      </p>

      <ApplicationsList applications={visible} now={now} errors={errors} onStatusChange={changeStatus} />
    </div>
  );
}
