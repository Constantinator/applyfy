import Link from "next/link";

import { IconSparkles } from "@/components/icons";
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
 * Bandeau affiché quand l'essai gratuit du mois d'une action IA est utilisé : fond blanc,
 * bordure fine et texte dans le bleu de marque. `resetLabel` : date de remise à zéro
 * (omise là où elle est déjà affichée). `premiumBadge` : pastille « Premium » au-dessus du message.
 */
export function UsageLimitBanner({
  resetLabel,
  message = LIMIT_REACHED_MESSAGE,
  premiumBadge = false,
}: {
  resetLabel?: string;
  message?: string;
  premiumBadge?: boolean;
}) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-[#1E40AF] bg-white p-4 text-sm">
      <div>
        {premiumBadge && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1E40AF] ring-1 ring-blue-200">
            <IconSparkles className="h-3.5 w-3.5" />
            Premium
          </p>
        )}
        <p className="font-medium text-[#1E40AF]">{message}</p>
        {resetLabel && <p className="mt-1 text-slate-500">Ton compteur repart à zéro le {resetLabel}.</p>}
      </div>
      <PremiumButton />
    </div>
  );
}
