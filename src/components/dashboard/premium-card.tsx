import Link from "next/link";

import { PlanChoice } from "@/components/premium/plan-choice";

/**
 * Carte « Passe au Premium », en dernier sur le tableau de bord. Affichée seulement aux comptes
 * gratuits (ni Premium, ni beta testeur actif) : la page décide, cf. isFreeAccount.
 */
export function PremiumCard({ paymentEnabled }: { paymentEnabled: boolean }) {
  return (
    <section aria-labelledby="premium-card-title" className="ui-card p-5 sm:p-7">
      <h2 id="premium-card-title" className="ui-title">
        Passe au Premium
      </h2>
      <p className="mt-2 mb-5 text-sm text-muted dark:text-slate-300">
        Lève les quotas du mois et la limite de Lumeo. Tu choisis ta formule.
      </p>
      <PlanChoice paymentEnabled={paymentEnabled} />
      <Link href="/premium" className="ui-link mt-3 inline-flex min-h-11 items-center text-sm underline">
        Voir le détail du Premium
      </Link>
    </section>
  );
}
