"use client";

import { useId, type ReactNode } from "react";

// Champs du formulaire du CV Builder.

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-200";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength = 120,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  maxLength?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength = 2000,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  /** Bouton affiché à droite du libellé (ex. IA). */
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {action}
      </div>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input resize-y"
      />
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
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
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
