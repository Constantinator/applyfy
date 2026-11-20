"use client";

import { useFormStatus } from "react-dom";

import { startCheckoutAction } from "@/app/actions/premium";
import { PREMIUM_MONTHLY_PLAN, PREMIUM_QUARTERLY_PLAN, QUARTERLY_SAVING_PERCENT, type PremiumPlan } from "@/lib/premium-plans";

/** Bouton de paiement d'une formule (état « Redirection… » pendant l'envoi). */
function CheckoutButton({ plan, featured, disabled }: { plan: PremiumPlan; featured: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={`Choisir Premium ${plan.name}`}
      className={`${featured ? "ui-btn-primary" : "ui-btn-secondary"} w-full`}
    >
      {pending ? "Redirection vers le paiement…" : "Choisir"}
    </button>
  );
}

/** Une formule : nom, prix ramené au mois, facturation et bouton de paiement. */
function PlanOption({ plan, featured, paymentEnabled }: { plan: PremiumPlan; featured: boolean; paymentEnabled: boolean }) {
  const titleId = `plan-choice-${plan.key}`;
  return (
    <section
      aria-labelledby={titleId}
      className={`relative flex flex-col gap-3 rounded-block border p-4 sm:p-5 ${
        featured ? "border-ink dark:border-white" : "border-line dark:border-slate-700"
      }`}
    >
      {featured && (
        <span className="absolute -top-3 right-4 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
          Meilleure offre · −{QUARTERLY_SAVING_PERCENT} %
        </span>
      )}
      <div>
        <h3 id={titleId} className="text-[15px] font-semibold text-ink dark:text-white">
          Premium {plan.name}
        </h3>
        <p className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.03em] text-ink dark:text-white">
          {plan.monthlyPrice} €
          <span className="text-sm font-medium tracking-normal text-muted dark:text-slate-300"> / mois</span>
        </p>
        <p className="mt-1 text-[13px] text-muted dark:text-slate-300">
          {plan.intervalMonths === 1
            ? "Sans engagement."
            : `Facturé ${plan.billedAmount} € tous les ${plan.intervalMonths} mois.`}
        </p>
      </div>
      <form action={startCheckoutAction.bind(null, plan.priceId)} className="mt-auto">
        <CheckoutButton plan={plan} featured={featured} disabled={!paymentEnabled} />
      </form>
    </section>
  );
}

/**
 * Les deux formules Premium côte à côte (l'une sous l'autre sur mobile), prix lus dans
 * premium-plans. Commun à la carte « Passe au Premium » et à l'écran de limite du coach.
 */
export function PlanChoice({ paymentEnabled }: { paymentEnabled: boolean }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-5 pt-3 sm:grid-cols-2">
        <PlanOption plan={PREMIUM_MONTHLY_PLAN} featured={false} paymentEnabled={paymentEnabled} />
        <PlanOption plan={PREMIUM_QUARTERLY_PLAN} featured paymentEnabled={paymentEnabled} />
      </div>
      <p className="text-xs text-muted dark:text-slate-300">
        {paymentEnabled
          ? "Paiement sécurisé par Stripe. Résiliable à tout moment."
          : "Le paiement n'est pas encore disponible sur ce site."}
      </p>
    </div>
  );
}
