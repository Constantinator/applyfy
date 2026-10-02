"use client";

import { useState } from "react";

import { limitReachedMessage, type AiUsageKind } from "@/lib/ai-usage-limits";

/** Bouton « Passer au Premium » : le paiement n'existe pas encore. */
export function PremiumButton() {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setClicked(true)} className="btn-primary px-4 py-2 text-sm">
        Passer au Premium
      </button>
      {clicked && (
        <span role="status" className="text-sm font-medium text-slate-600">
          Bientôt disponible
        </span>
      )}
    </div>
  );
}

/** Bandeau affiché quand la limite mensuelle d'une action IA est atteinte. */
export function UsageLimitBanner({ kind, resetLabel }: { kind: AiUsageKind; resetLabel: string }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-lg leading-none">
          ⏳
        </span>
        <div>
          <p className="font-medium text-amber-900">{limitReachedMessage(kind)}</p>
          <p className="mt-1 text-amber-800">
            Ton compteur repart à zéro le {resetLabel}. Passe au Premium pour continuer sans attendre.
          </p>
        </div>
      </div>
      <PremiumButton />
    </div>
  );
}
