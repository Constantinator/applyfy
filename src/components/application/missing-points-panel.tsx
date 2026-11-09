"use client";

import { useState } from "react";

import type { KeywordMatch } from "@/lib/cv-keyword-match";
import type { KeywordGroup } from "@/lib/cv-types";

import { KeywordMatchView, KeywordRate } from "./keyword-match-view";

/** Phrase à compléter par le candidat : le mot-clé n'est ajouté que s'il décrit une vraie expérience. */
const PROMPTS: Record<KeywordGroup, (keyword: string) => string> = {
  technique: (k) => `J'ai utilisé ${k} pour… (précise le contexte et un résultat)`,
  comportementale: (k) => `J'ai fait preuve de « ${k} » quand… (précise le contexte et un résultat)`,
  mise_en_avant: (k) => `J'ai une expérience en « ${k} » : … (précise le contexte et un résultat)`,
};

/**
 * Onglet « Mots-clés » du CV Builder : taux de correspondance et mots-clés de l'offre absents du
 * CV. Un clic prépare une phrase à compléter dans le chat : rien n'est envoyé.
 */
export function MissingKeywordsPanel({ match, onInsert }: { match: KeywordMatch; onInsert?: (text: string) => void }) {
  const groupOf = new Map(match.rows.map((r) => [r.keyword, r.group]));

  return (
    <div className="space-y-4">
      <KeywordRate rate={match.rate} />
      <KeywordMatchView
        match={match}
        onPick={onInsert ? (keyword) => onInsert(PROMPTS[groupOf.get(keyword) ?? "technique"](keyword)) : undefined}
      />
    </div>
  );
}

/** Points « Ce qui manque » d'une analyse d'avant les mots-clés. Un clic les copie et les ajoute au chat. */
export function MissingPointsPanel({ points, onInsert }: { points: string[]; onInsert?: (text: string) => void }) {
  const [copied, setCopied] = useState<number | null>(null);

  async function pick(point: string, index: number) {
    onInsert?.(`Ajoute à mon CV : ${point}`);
    try {
      await navigator.clipboard.writeText(point);
    } catch {
      // Presse-papiers indisponible (navigateur, permissions) : l'ajout au chat suffit.
    }
    setCopied(index);
    setTimeout(() => setCopied((current) => (current === index ? null : current)), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted dark:text-slate-400">
        D&apos;après l&apos;analyse de ton CV.{onInsert ? " Clique sur un point pour l'envoyer dans le chat." : " Clique sur un point pour le copier."}
      </p>
      <ul className="space-y-1.5">
        {points.map((point, index) => (
          <li key={`${index}-${point}`}>
            <button
              type="button"
              onClick={() => pick(point, index)}
              className="ui-focus min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-xs leading-snug text-prose transition hover:border-line-strong hover:bg-white lg:min-h-0 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {point}
              {copied === index && (
                <span role="status" className="mt-1 block font-medium text-accent dark:text-blue-300">
                  {onInsert ? "✓ Ajouté au chat" : "✓ Copié"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
