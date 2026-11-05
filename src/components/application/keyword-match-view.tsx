"use client";

import type { KeywordMatch } from "@/lib/cv-keyword-match";
import { KEYWORD_GROUPS, KEYWORD_MATCH_TARGET } from "@/lib/cv-types";

/** Chevron des accordéons ; `className` : rotation à l'ouverture (variante group-open du parent). */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${className}`}>
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Taux de correspondance des mots-clés, avec la cible. */
export function KeywordRate({ rate }: { rate: number | null }) {
  if (rate === null) return null;
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {rate} % de correspondance avec l&apos;offre (cible : {KEYWORD_MATCH_TARGET} %)
    </p>
  );
}

const TAG = "rounded-full border-0 bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200";

/**
 * Mots-clés de l'offre absents du CV, par catégorie en accordéon (replié par défaut). `onPick` :
 * les mots-clés deviennent cliquables.
 */
export function KeywordMatchView({ match, onPick }: { match: KeywordMatch; onPick?: (keyword: string) => void }) {
  const rows = match.rows.filter((r) => !r.present && !r.ignored);
  const groups = KEYWORD_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id) })).filter((g) => g.rows.length > 0);
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Tous les mots-clés de l&apos;offre sont dans ton CV.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {groups.map((g) => (
        <details key={g.id} className="group/keywords">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase [&::-webkit-details-marker]:hidden dark:text-slate-400">
            <span>
              {g.label} ({g.rows.length})
            </span>
            <Chevron className="group-open/keywords:rotate-180" />
          </summary>
          <ul className="flex flex-wrap gap-1.5 pb-3">
            {g.rows.map((row) => (
              <li key={row.keyword}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(row.keyword)}
                    title="Préparer un message pour le chat"
                    className={`${TAG} transition hover:bg-slate-200 dark:hover:bg-slate-600`}
                  >
                    {row.keyword}
                  </button>
                ) : (
                  <span className={`${TAG} inline-block`}>{row.keyword}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
