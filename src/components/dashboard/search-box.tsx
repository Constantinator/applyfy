"use client";

import { useRef } from "react";

/** Recherche d'une candidature par poste ou entreprise (filtrage côté client, à chaque frappe). */
export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div role="search" className="relative w-full sm:max-w-sm">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Rechercher une candidature"
        placeholder="Rechercher un poste ou une entreprise"
        autoComplete="off"
        enterKeyHint="search"
        // 16 px sur mobile : pas de zoom automatique sur iOS.
        className="input py-2 pr-9 pl-9 text-base sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
