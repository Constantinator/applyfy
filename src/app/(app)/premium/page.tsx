import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { openBillingPortalAction, startCheckoutAction } from "@/app/actions/premium";
import { IconSparkles } from "@/components/icons";
import { AI_MONTHLY_LIMITS, PREMIUM_PRICE_LABEL } from "@/lib/ai-usage-limits";
import { requireUser } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { BETA_PREMIUM_UNTIL_LABEL } from "@/lib/beta-rules";
import { getSubscription } from "@/lib/subscription";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Premium — Applyfy" };

const ERRORS: Record<string, string> = {
  config: "Le paiement n'est pas encore configuré sur ce site.",
  paiement: "La page de paiement n'a pas pu s'ouvrir. Réessaie dans un instant.",
};

const L = AI_MONTHLY_LIMITS;

const FREE_FEATURES = [
  `${L.resume_offre} résumés d'offre par mois`,
  `${L.adaptation_cv} analyses de CV par mois`,
  `${L.cv_ameliore} CV améliorés par mois`,
  `${L.lettre} lettres de motivation par mois`,
  `${L.affinage_cv} messages par mois au chat « Affiner avec l'IA » (CV et lettre)`,
];

const PREMIUM_FEATURES = [
  "Résumés d'offre illimités",
  "Analyses de CV illimitées",
  "CV améliorés illimités",
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
          Utilise toutes les fonctionnalités IA d&apos;Applyfy sans limite, pour {PREMIUM_PRICE_LABEL}.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="plan-gratuit" className="card flex flex-col gap-5 p-6">
          <div>
            <h2 id="plan-gratuit" className="font-semibold text-slate-900">
              Plan Gratuit
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">0 €</p>
            <p className="mt-1 text-sm text-slate-500">Compteurs remis à zéro le 1er de chaque mois.</p>
          </div>
          <FeatureList items={FREE_FEATURES} tone="slate" />
          <p className="mt-auto pt-2 text-sm font-medium text-slate-500">
            {premium ? "Ton ancien plan" : "Ton plan actuel"}
          </p>
        </section>

        <section
          aria-labelledby="plan-premium"
          className="card flex flex-col gap-5 p-6 ring-2 ring-blue-500"
        >
          <div>
            <h2 id="plan-premium" className="flex items-center gap-2 font-semibold text-slate-900">
              <IconSparkles className="h-4 w-4 text-blue-600" />
              Plan Premium
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              8 €<span className="text-base font-medium text-slate-500"> / mois</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">Sans engagement, résiliable à tout moment.</p>
          </div>
          <FeatureList items={PREMIUM_FEATURES} tone="blue" />
          <div className="mt-auto pt-2">
            {stripePremium ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-emerald-700">✓ Tu es Premium</p>
                <form action={openBillingPortalAction}>
                  <button type="submit" className="btn-secondary px-4 py-2.5 text-sm">
                    Gérer mon abonnement
                  </button>
                </form>
              </div>
            ) : premium ? (
              <p className="text-sm font-medium text-emerald-700">
                ✓ Premium offert en tant que beta testeur, jusqu&apos;au {BETA_PREMIUM_UNTIL_LABEL}.
              </p>
            ) : (
              <form action={startCheckoutAction} className="space-y-2">
                <button
                  type="submit"
                  disabled={!paymentEnabled}
                  className="btn-primary w-full px-4 py-2.5 text-sm"
                >
                  Passer au Premium
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
      </div>
    </main>
  );
}
