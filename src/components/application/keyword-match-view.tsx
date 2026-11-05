"use client";

import type { KeywordMatch } from "@/lib/cv-keyword-match";
import { KEYWORD_GROUPS } from "@/lib/cv-types";

/** Taux de correspondance des mots-clés. */
export function KeywordRate({ rate }: { rate: number | null }) {
  if (rate === null) return null;
  return <p className="text-sm text-slate-500 dark:text-slate-400">{rate} % de correspondance avec l&apos;offre</p>;
}

const TAG = "rounded-full bg-red-50 px-3 py-1 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300";

/** Mots-clés de l'offre absents du CV, par catégorie. `onPick` : les mots-clés deviennent cliquables. */
export function KeywordMatchView({ match, onPick }: { match: KeywordMatch; onPick?: (keyword: string) => void }) {
  const rows = match.rows.filter((r) => !r.present && !r.ignored);
  const groups = KEYWORD_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id) })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{g.label}</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {g.rows.map((row) => (
              <li key={row.keyword}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(row.keyword)}
                    title="Préparer un message pour le chat"
                    className={`${TAG} transition hover:bg-red-100 dark:hover:bg-red-900/50`}
                  >
                    {row.keyword}
                  </button>
                ) : (
                  <span className={`${TAG} inline-block`}>{row.keyword}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
