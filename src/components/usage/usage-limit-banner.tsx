import Link from "next/link";

import { LIMIT_REACHED_MESSAGE } from "@/lib/ai-usage-limits";

/** Bouton « Passer au Premium » : page de présentation et de paiement du Premium. */
export function PremiumButton() {
  return (
    <Link href="/premium" className="btn-primary inline-flex px-4 py-2 text-sm">
      Passer au Premium
    </Link>
  );
}

/**
 * Bandeau affiché quand la limite mensuelle d'une action IA est atteinte : fond blanc,
 * bordure fine et texte dans le bleu de marque. `resetLabel` : date de remise à zéro
 * (omise là où elle est déjà affichée, ex. « Mon utilisation »).
 */
export function UsageLimitBanner({ resetLabel }: { resetLabel?: string }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-[#1E40AF] bg-white p-4 text-sm">
      <div>
        <p className="font-medium text-[#1E40AF]">{LIMIT_REACHED_MESSAGE}</p>
        {resetLabel && <p className="mt-1 text-slate-500">Ton compteur repart à zéro le {resetLabel}.</p>}
      </div>
      <PremiumButton />
    </div>
  );
}
