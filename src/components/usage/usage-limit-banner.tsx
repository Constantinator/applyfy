import Link from "next/link";

import { IconSparkles } from "@/components/icons";
import { LIMIT_REACHED_MESSAGE } from "@/lib/ai-usage-limits";

/** Bouton « Passer au Premium » : page de présentation et de paiement du Premium. */
export function PremiumButton() {
  return (
    <Link href="/premium" className="ui-btn-primary lg:min-h-0! lg:px-4! lg:py-[9px]! lg:text-[13px]!">
      Passer au Premium
    </Link>
  );
}

/**
 * Bandeau affiché quand le quota gratuit du mois d'une action IA est utilisé : fond blanc,
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
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] border border-line bg-surface px-5 py-[18px] text-[14.5px]">
      <div className="min-w-[220px] flex-1">
        {premiumBadge && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-pill px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">
            <IconSparkles className="h-3.5 w-3.5" />
            Premium
          </p>
        )}
        <p className="font-semibold text-ink">{message}</p>
        {resetLabel && <p className="mt-0.5 text-[13.5px] text-muted">Ton compteur repart à zéro le {resetLabel}.</p>}
      </div>
      <PremiumButton />
    </div>
  );
}
