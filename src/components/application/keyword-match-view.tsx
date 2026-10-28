"use client";

import type { KeywordMatch, KeywordMatchRow } from "@/lib/cv-keyword-match";
import { KEYWORD_GROUPS, KEYWORD_MATCH_TARGET } from "@/lib/cv-types";

/** Couleur du taux : vert à partir de la cible, orange au-dessus de 50 %, rouge en dessous. */
function rateTone(rate: number) {
  if (rate >= KEYWORD_MATCH_TARGET) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (rate >= 50) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}

/** Taux de correspondance des mots-clés, avec la cible. */
export function KeywordRate({ rate }: { rate: number | null }) {
  if (rate === null) return null;
  const tone = rateTone(rate);
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600 dark:text-slate-300">
        <span className={`text-2xl font-bold ${tone.text}`}>{rate} %</span>
        <span>de correspondance avec l&apos;offre</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Cible : {KEYWORD_MATCH_TARGET} % ou plus</span>
      </p>
      <div
        role="meter"
        aria-label="Taux de correspondance des mots-clés"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate}
        className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${rate}%` }} />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-slate-500"
          style={{ left: `${KEYWORD_MATCH_TARGET}%` }}
        />
      </div>
    </div>
  );
}

function KeywordChip({
  row,
  onToggleIgnore,
  onPick,
  busy,
}: {
  row: KeywordMatchRow;
  onToggleIgnore?: (keyword: string, ignore: boolean) => void;
  onPick?: (keyword: string) => void;
  busy: boolean;
}) {
  const tone = row.ignored
    ? "border-slate-200 bg-slate-50 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
    : row.present
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300";
  const status = row.ignored ? "ignoré" : row.present ? "présent dans ton CV" : "absent de ton CV";
  const label = (
    <>
      <span aria-hidden="true">{row.ignored ? "" : row.present ? "✓ " : "✗ "}</span>
      {row.keyword}
      <span className="sr-only"> ({status})</span>
    </>
  );

  return (
    <li className={`inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs font-medium ${tone}`}>
      {onPick && !row.present && !row.ignored ? (
        <button
          type="button"
          onClick={() => onPick(row.keyword)}
          className="underline-offset-2 hover:underline"
          title="Préparer un message pour le chat"
        >
          {label}
        </button>
      ) : (
        <span className={onToggleIgnore ? "" : "pr-1.5"}>{label}</span>
      )}
      {onToggleIgnore && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleIgnore(row.keyword, !row.ignored)}
          className="rounded-full px-1.5 text-[11px] font-normal no-underline opacity-70 hover:bg-white/70 hover:opacity-100 disabled:opacity-40 dark:hover:bg-slate-900/50"
          aria-label={row.ignored ? `Rétablir « ${row.keyword} »` : `Ignorer « ${row.keyword} »`}
        >
          {row.ignored ? "Rétablir" : "Ignorer"}
        </button>
      )}
    </li>
  );
}

/**
 * Mots-clés de l'offre par groupe : vert s'ils sont dans le CV, rouge s'ils manquent, barrés
 * s'ils sont ignorés. `missingOnly` : seulement les mots-clés manquants (éditeur du CV).
 */
export function KeywordMatchView({
  match,
  onToggleIgnore,
  onPick,
  busyKeyword = null,
  missingOnly = false,
}: {
  match: KeywordMatch;
  onToggleIgnore?: (keyword: string, ignore: boolean) => void;
  onPick?: (keyword: string) => void;
  busyKeyword?: string | null;
  missingOnly?: boolean;
}) {
  const rows = missingOnly ? match.rows.filter((r) => !r.present && !r.ignored) : match.rows;
  const groups = KEYWORD_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.id) })).filter(
    (g) => g.rows.length > 0,
  );
  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {missingOnly ? "Tous les mots-clés de l'offre sont dans ton CV." : "Aucun mot-clé relevé dans l'offre."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{g.label}</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {g.rows.map((row) => (
              <KeywordChip
                key={row.keyword}
                row={row}
                onToggleIgnore={onToggleIgnore}
                onPick={onPick}
                busy={busyKeyword === row.keyword}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
