"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";

import { updateStatusAction } from "@/app/actions/applications";
import { FOLLOW_UP_FILTER, needsFollowUp } from "@/lib/follow-up";
import { matchesSearch, normalizeSearch } from "@/lib/search";
import { DEFAULT_SORT, SORT_OPTIONS, sortApplications, type SortKey } from "@/lib/sort-applications";
import { APPLICATION_STATUSES, STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/types";

import { ApplicationsList } from "./applications-list";
import { SearchBox } from "./search-box";
import { StatusFilter, type FilterOption } from "./status-filter";

const ALL = "toutes";
/** Nombre de candidatures à partir duquel la recherche est proposée. */
const SEARCH_MIN_APPLICATIONS = 6;

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

  // Recherche (poste ou entreprise), appliquée à la liste optimiste avant les filtres de statut :
  // compteurs et liste reflètent la recherche. Proposée à partir de SEARCH_MIN_APPLICATIONS
  // candidatures (liste complète) ; ignorée en dessous.
  const [query, setQuery] = useState("");
  const searchable = applications.length >= SEARCH_MIN_APPLICATIONS;
  const normalizedQuery = searchable ? normalizeSearch(query) : "";
  const searched = useMemo(
    () => (normalizedQuery ? applications.filter((app) => matchesSearch(app, normalizedQuery)) : applications),
    [applications, normalizedQuery],
  );

  const filterOptions: FilterOption[] = useMemo(
    () => [
      { value: ALL, label: "Toutes", count: searched.length },
      {
        value: FOLLOW_UP_FILTER,
        label: "À relancer",
        count: searched.filter((app) => needsFollowUp(app, now)).length,
      },
      ...APPLICATION_STATUSES.map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
        count: searched.filter((app) => app.status === status).length,
      })),
    ],
    [searched, now],
  );

  const visible = useMemo(() => {
    const filtered =
      filter === ALL
        ? searched
        : filter === FOLLOW_UP_FILTER
          ? searched.filter((app) => needsFollowUp(app, now))
          : searched.filter((app) => app.status === filter);
    return sortApplications(filtered, sort);
  }, [searched, filter, sort, now]);

  return (
    <div className="space-y-4">
      {searchable && <SearchBox value={query} onChange={setQuery} />}

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

      {normalizedQuery && visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-white">Aucune candidature ne correspond à ta recherche</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Effacer la recherche
          </button>
        </div>
      ) : (
        <ApplicationsList applications={visible} now={now} errors={errors} onStatusChange={changeStatus} />
      )}
    </div>
  );
}
