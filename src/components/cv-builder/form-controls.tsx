"use client";

import { createContext, useContext, useId, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";

import { enterAction, fieldLimit, fieldLimitMessage, hasLineMerge, keepsCaretOnBlank } from "@/lib/cv-builder-types";

import { cutLine } from "./use-line-editing";

// Champs du formulaire du CV Builder : Entrée, Retour arrière et limites sont ceux de l'aperçu.

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-200";

/** Lignes de liste et messages de l'éditeur, fournis par le panneau qui contient les champs. */
export const FieldEditingContext = createContext<{
  notify: (message: string) => void;
  breakLine?: (path: string, before: string, after: string) => void;
  mergeWithPrevious?: (path: string) => boolean;
} | null>(null);

/**
 * Comportement commun d'un champ du formulaire, désigné par son chemin dans le CV. Saisie au-delà de
 * la limite refusée avec un message (`limit` : place restante, si elle est plus petite que la limite du
 * champ). Un texte déjà trop long peut toujours être raccourci.
 */
export function useFieldControl(path: string, value: string, onChange: (value: string) => void, limit = fieldLimit(path)) {
  const editing = useContext(FieldEditingContext);
  return {
    value,
    "data-line-path": path,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      if (next.length > limit && next.length > value.length) {
        editing?.notify(fieldLimitMessage(path, limit));
        return;
      }
      onChange(next);
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      const el = e.currentTarget;
      if (e.key === "Backspace") {
        if (hasLineMerge(path) && el.selectionStart === 0 && el.selectionEnd === 0 && editing?.mergeWithPrevious?.(path)) e.preventDefault();
        return;
      }
      if (e.key !== "Enter") return;
      const action = enterAction(path);
      if (action === "newline") return; // paragraphe : saut de ligne du navigateur
      e.preventDefault();
      if (action === "validate") el.blur();
      else if (action === "below") editing?.breakLine?.(path, value, "");
      else if (value.trim() || !keepsCaretOnBlank(path)) {
        // Ligne de liste : sur une ligne vide, le curseur reste en place.
        const [before, after] = cutLine(path, value.slice(0, el.selectionStart ?? value.length), value.slice(el.selectionEnd ?? value.length));
        editing?.breakLine?.(path, before, after);
      }
    },
  };
}

/** Champ d'une ligne. */
export function FieldInput({
  path,
  value,
  onChange,
  limit,
  ...props
}: {
  path: string;
  value: string;
  onChange: (value: string) => void;
  limit?: number;
  id?: string;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const control = useFieldControl(path, value, onChange, limit);
  return <input {...props} {...control} />;
}

export function Field({
  label,
  path,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  /** Chemin du champ dans le CV : sa limite et l'effet d'Entrée en dépendent. */
  path: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <FieldInput id={id} path={path} type={type} value={value} placeholder={placeholder} onChange={onChange} className="input" />
    </div>
  );
}

export function TextArea({
  label,
  path,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  path: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const control = useFieldControl(path, value, onChange);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea id={id} rows={rows} placeholder={placeholder} className="input resize-y" {...control} />
    </div>
  );
}

const iconButton =
  "rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white";

/** Carte d'un élément de liste (expérience, formation…) : titre, réorganisation, suppression. */
export function ItemCard({
  title,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 text-sm font-semibold break-words text-slate-900 dark:text-white">{title}</p>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={iconButton} aria-label={`Monter « ${title} »`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          className={iconButton}
          aria-label={`Descendre « ${title} »`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15"
        >
          Supprimer
        </button>
      </div>
      {children}
    </div>
  );
}

export function AddButton({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-secondary w-full px-4 py-2.5 text-sm">
      {children}
    </button>
  );
}

/** Déplace l'élément `index` de `delta` positions. */
export function move<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
