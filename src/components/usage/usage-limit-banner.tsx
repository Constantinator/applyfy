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

/** Bandeau affiché quand la limite mensuelle d'une action IA est atteinte. */
export function UsageLimitBanner({ resetLabel }: { resetLabel: string }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-lg leading-none">
          ⏳
        </span>
        <div>
          <p className="font-medium text-amber-900">{LIMIT_REACHED_MESSAGE}</p>
          <p className="mt-1 text-amber-800">Ton compteur repart à zéro le {resetLabel}.</p>
        </div>
      </div>
      <PremiumButton />
    </div>
  );
}
