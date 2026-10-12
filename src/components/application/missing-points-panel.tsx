"use client";

import { useState } from "react";

/**
 * Panneau « Ce qui manque » de l'éditeur de CV : les points de l'analyse faite pour cette
 * candidature. Un clic copie le point (presse-papiers) et l'ajoute au champ du chat.
 */
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
    <section aria-labelledby="missing-title" className="card mt-4 space-y-3 p-4 print:hidden">
      <div>
        <h2 id="missing-title" className="text-sm font-semibold text-slate-900">
          Ce qui manque
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          D&apos;après l&apos;analyse de ton CV.{onInsert ? " Clique sur un point pour l'envoyer dans le chat." : " Clique sur un point pour le copier."}
        </p>
      </div>
      <ul className="space-y-1.5">
        {points.map((point, index) => (
          <li key={`${index}-${point}`}>
            <button
              type="button"
              onClick={() => pick(point, index)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 text-left text-xs leading-snug text-[#374151] transition hover:border-blue-300 hover:bg-white"
            >
              {point}
              {copied === index && (
                <span role="status" className="mt-1 block font-medium text-blue-700">
                  {onInsert ? "✓ Ajouté au chat" : "✓ Copié"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
