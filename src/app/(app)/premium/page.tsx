import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { openBillingPortalAction, startCheckoutAction } from "@/app/actions/premium";
import { IconSparkles } from "@/components/icons";
import { AI_MONTHLY_LIMITS, PREMIUM_PRICE_FROM_LABEL } from "@/lib/ai-usage-limits";
import { requireUser } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { PREMIUM_PLANS, QUARTERLY_SAVING_PERCENT } from "@/lib/premium-plans";
import { BETA_PREMIUM_UNTIL_LABEL } from "@/lib/beta-rules";
import { getSubscription } from "@/lib/subscription";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Premium — Applyfy" };

const ERRORS: Record<string, string> = {
  config: "Le paiement n'est pas encore configuré sur ce site.",
  paiement: "La page de paiement n'a pas pu s'ouvrir. Réessaie dans un instant.",
};

const L = AI_MONTHLY_LIMITS;
/** « 1 résumé », « 2 résumés ». */
const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const FREE_FEATURES = [
  `${count(L.resume_offre, "résumé", "résumés")} d'offre par mois`,
  `${count(L.adaptation_cv, "analyse", "analyses")} de CV par mois`,
  `${count(L.cv_ameliore, "CV ouvert", "CV ouverts")} dans l'éditeur par mois`,
  `${count(L.lettre, "lettre", "lettres")} de motivation par mois`,
  `${count(L.affinage_cv, "message", "messages")} par mois au chat « Affiner avec l'IA » (CV et lettre)`,
];

const PREMIUM_FEATURES = [
  "Résumés d'offre illimités",
  "Analyses de CV illimitées",
  "Éditeur de CV illimité",
  "Lettres de motivation illimitées",
  "Chat « Affiner avec l'IA » illimité",
];

function FeatureList({ items, tone }: { items: string[]; tone: "slate" | "blue" }) {
  return (
    <ul className="space-y-2.5 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className={tone === "blue" ? "font-bold text-blue-600" : "text-slate-400"}>
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function PremiumPage({ searchParams }: PageProps<"/premium">) {
  await connection(); // statut Premium lu à chaque visite
  if (isSupabaseConfigured()) await requireUser();
  const { erreur } = await searchParams;
  const error = typeof erreur === "string" ? ERRORS[erreur] : undefined;
  const [subscription, beta] = await Promise.all([getSubscription(), getMyBeta()]);
  const stripePremium = subscription?.premium ?? false;
  const premium = stripePremium || hasBetaPremium(beta);
  const paymentEnabled = isSupabaseConfigured() && isStripeConfigured();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Passe au Premium</h1>
        <p className="mt-1.5 text-slate-500">
          Utilise toutes les fonctionnalités IA d&apos;Applyfy sans limite, {PREMIUM_PRICE_FROM_LABEL}.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {PREMIUM_PLANS.map((plan) => {
          const featured = plan.key === "trimestriel";
          return (
            <section
              key={plan.key}
              aria-labelledby={`plan-${plan.key}`}
              className={`card relative flex flex-col gap-5 p-6 ${featured ? "ring-2 ring-blue-500" : ""}`}
            >
              {featured && (
                <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Économise {QUARTERLY_SAVING_PERCENT} %
                </span>
              )}
              <div>
                <h2 id={`plan-${plan.key}`} className="flex items-center gap-2 font-semibold text-slate-900">
                  <IconSparkles className="h-4 w-4 text-blue-600" />
                  Premium {plan.name}
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {plan.monthlyPrice} €<span className="text-base font-medium text-slate-500"> / mois</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {plan.intervalMonths === 1
                    ? "Sans engagement, résiliable à tout moment."
                    : `Facturé ${plan.billedAmount} € tous les ${plan.intervalMonths} mois, renouvelable. Résiliable à tout moment pour la période suivante.`}
                </p>
              </div>
              <FeatureList items={PREMIUM_FEATURES} tone="blue" />
              <div className="mt-auto pt-2">
                {!premium && (
                  <form action={startCheckoutAction.bind(null, plan.priceId)} className="space-y-2">
                    <button
                      type="submit"
                      disabled={!paymentEnabled}
                      className={`${featured ? "btn-primary" : "btn-secondary"} w-full px-4 py-2.5 text-sm`}
                    >
                      Choisir l&apos;offre {plan.name}
                    </button>
                    <p className="text-xs text-slate-500">
                      {paymentEnabled
                        ? "Paiement sécurisé par Stripe."
                        : "Le paiement n'est pas encore disponible sur ce site."}
                    </p>
                  </form>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {stripePremium ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm font-medium text-emerald-700">✓ Tu es Premium</p>
          <form action={openBillingPortalAction}>
            <button type="submit" className="btn-secondary px-4 py-2.5 text-sm">
              Gérer mon abonnement
            </button>
          </form>
        </div>
      ) : (
        premium && (
          <p className="card p-5 text-sm font-medium text-emerald-700">
            ✓ Premium offert en tant que beta testeur, jusqu&apos;au {BETA_PREMIUM_UNTIL_LABEL}.
          </p>
        )
      )}

      <section aria-labelledby="plan-gratuit" className="card space-y-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="plan-gratuit" className="font-semibold text-slate-900">
            Plan Gratuit · 0 €
          </h2>
          <p className="text-sm font-medium text-slate-500">{premium ? "Ton ancien plan" : "Ton plan actuel"}</p>
        </div>
        <FeatureList items={FREE_FEATURES} tone="slate" />
        <p className="text-sm text-slate-500">Compteurs remis à zéro le 1er de chaque mois.</p>
      </section>
    </main>
  );
}
