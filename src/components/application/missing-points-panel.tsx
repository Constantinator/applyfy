"use client";

import { useState } from "react";

import { matchCvKeywords } from "@/lib/cv-keyword-match";
import type { Sector } from "@/lib/cv-sector-context";
import type { KeywordGroup, OfferKeyword } from "@/lib/cv-types";

import { KeywordMatchView, KeywordRate } from "./keyword-match-view";

/** Mots-clés de l'analyse « Adapter mon CV », comparés au CV affiché dans l'éditeur. */
export type EditorKeywords = { keywords: OfferKeyword[]; ignored: string[]; sector: Sector };

/** Phrase à compléter par le candidat : le mot-clé n'est ajouté que s'il décrit une vraie expérience. */
const PROMPTS: Record<KeywordGroup, (keyword: string) => string> = {
  technique: (k) => `J'ai utilisé ${k} pour… (précise le contexte et un résultat)`,
  comportementale: (k) => `J'ai fait preuve de « ${k} » quand… (précise le contexte et un résultat)`,
  mise_en_avant: (k) => `J'ai une expérience en « ${k} » : … (précise le contexte et un résultat)`,
};

/** Encart repliable au-dessus du chat, à hauteur limitée pour laisser la place à la conversation. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="card shrink-0">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white">{title}</summary>
      <div className="max-h-44 space-y-3 overflow-y-auto px-4 pb-4">{children}</div>
    </details>
  );
}

/**
 * Mots-clés de l'offre manquants dans le CV : taux de correspondance et mots-clés, recalculés sur
 * le texte affiché. Un clic pré-remplit le chat avec une phrase à compléter : rien n'est envoyé.
 */
export function MissingKeywordsPanel({
  analysis,
  cvText,
  onInsert,
}: {
  analysis: EditorKeywords;
  cvText: string | null;
  onInsert?: (text: string) => void;
}) {
  const match = matchCvKeywords(analysis, cvText, analysis.sector);
  const groupOf = new Map(analysis.keywords.map((k) => [k.keyword, k.group]));

  return (
    <Panel title="Mots-clés manquants">
      {onInsert && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Clique sur un mot-clé pour préparer un message au coach, à compléter avec ton expérience.
        </p>
      )}
      <KeywordRate rate={match.rate} />
      <KeywordMatchView
        match={match}
        missingOnly
        onPick={onInsert ? (keyword) => onInsert(PROMPTS[groupOf.get(keyword) ?? "technique"](keyword)) : undefined}
      />
    </Panel>
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
    <Panel title="Ce qui manque">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        D&apos;après l&apos;analyse de ton CV.{onInsert ? " Clique sur un point pour l'envoyer dans le chat." : " Clique sur un point pour le copier."}
      </p>
      <ul className="space-y-1.5">
        {points.map((point, index) => (
          <li key={`${index}-${point}`}>
            <button
              type="button"
              onClick={() => pick(point, index)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs leading-snug text-slate-700 transition hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {point}
              {copied === index && (
                <span role="status" className="mt-1 block font-medium text-blue-700 dark:text-blue-300">
                  {onInsert ? "✓ Ajouté au chat" : "✓ Copié"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
