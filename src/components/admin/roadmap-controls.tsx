"use client";

import { useState, useTransition } from "react";

import {
  addRoadmapItemAction,
  deleteRoadmapItemAction,
  setRoadmapStatusAction,
} from "@/app/actions/roadmap";
import {
  nextRoadmapStatus,
  ROADMAP_CATEGORIES,
  ROADMAP_CATEGORY_LABELS,
  ROADMAP_DESCRIPTION_MAX_LENGTH,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_STYLES,
  ROADMAP_STATUSES,
  ROADMAP_TITLE_MAX_LENGTH,
  type RoadmapCategory,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/lib/roadmap-options";

/** « Ajouter un élément » : bouton qui déplie un formulaire inline. */
export function AddRoadmapItemForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<RoadmapStatus>("a_faire");
  const [category, setCategory] = useState<RoadmapCategory>("court_terme");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="ui-btn-primary">
        + Ajouter un élément
      </button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addRoadmapItemAction({ title, description, status, category });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDescription("");
      setOpen(false);
    });
  }

  return (
    <form onSubmit={submit} className="ui-card space-y-3 p-5 sm:p-7">
      <div className="space-y-1.5">
        <label htmlFor="roadmap-title" className="text-sm font-medium text-ink">
          Titre
        </label>
        <input
          id="roadmap-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={ROADMAP_TITLE_MAX_LENGTH}
          required
          autoFocus
          className="ui-input py-2"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="roadmap-description" className="text-sm font-medium text-ink">
          Description <span className="font-normal text-muted">(optionnelle)</span>
        </label>
        <textarea
          id="roadmap-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={ROADMAP_DESCRIPTION_MAX_LENGTH}
          rows={3}
          className="ui-input py-2"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="roadmap-category" className="text-sm font-medium text-ink">
            Catégorie
          </label>
          <select
            id="roadmap-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as RoadmapCategory)}
            className="ui-input py-2"
          >
            {ROADMAP_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {ROADMAP_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="roadmap-status" className="text-sm font-medium text-ink">
            Statut
          </label>
          <select
            id="roadmap-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as RoadmapStatus)}
            className="ui-input py-2"
          >
            {ROADMAP_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ROADMAP_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ui-btn-secondary"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Un élément de la roadmap : clic sur le badge = statut suivant ; suppression confirmée. */
export function RoadmapItemCard({ item }: { item: RoadmapItem }) {
  // Statut affiché tout de suite au clic, avant la réponse du serveur.
  const [status, setStatus] = useState(item.status);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = nextRoadmapStatus(status);

  function cycleStatus() {
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await setRoadmapStatusAction(item.id, next);
      if (!result.ok) {
        setStatus(previous);
        setError(result.error);
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoadmapItemAction(item.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="ui-card flex flex-col gap-2 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`font-semibold ${status === "termine" ? "text-muted line-through" : "text-ink"}`}
        >
          {item.title}
        </h3>
        <button
          type="button"
          onClick={cycleStatus}
          title={`Passer à « ${ROADMAP_STATUS_LABELS[next]} »`}
          aria-label={`Statut : ${ROADMAP_STATUS_LABELS[status]}. Passer à « ${ROADMAP_STATUS_LABELS[next]} »`}
          className={`ui-hit relative shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 transition hover:brightness-95 ${ROADMAP_STATUS_STYLES[status]}`}
        >
          {ROADMAP_STATUS_LABELS[status]}
        </button>
      </div>
      {item.description && (
        <p className="text-sm leading-relaxed whitespace-pre-line text-muted">
          {item.description}
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="mt-auto flex justify-end pt-1">
        {confirming ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Supprimer ?</span>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="ui-btn-danger"
            >
              {pending ? "Suppression…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="ui-btn-secondary"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ui-btn-danger"
          >
            Supprimer
          </button>
        )}
      </div>
    </li>
  );
}
