import {
  PREMIUM_PRICE_MONTHLY,
  PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY,
  PREMIUM_PRICE_QUARTERLY,
} from "./ai-usage-limits";

// Les deux offres Premium et leur prix récurrent Stripe (identifiants publics, mode live).

export type PremiumPlan = {
  key: "mensuel" | "trimestriel";
  name: string;
  priceId: string;
  /** Prix ramené au mois, en euros (MRR). */
  monthlyPrice: number;
  /** Montant prélevé à chaque échéance, en euros. */
  billedAmount: number;
  /** Durée d'une échéance, en mois. */
  intervalMonths: number;
};

export const PREMIUM_MONTHLY_PLAN: PremiumPlan = {
  key: "mensuel",
  name: "Mensuel",
  priceId: "price_1UTu1y2feV20izkYX4BTsYpd",
  monthlyPrice: PREMIUM_PRICE_MONTHLY,
  billedAmount: PREMIUM_PRICE_MONTHLY,
  intervalMonths: 1,
};

export const PREMIUM_QUARTERLY_PLAN: PremiumPlan = {
  key: "trimestriel",
  name: "3 mois",
  priceId: "price_1UTu5J2feV20izkYlaN6taxg",
  monthlyPrice: PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY,
  billedAmount: PREMIUM_PRICE_QUARTERLY,
  intervalMonths: 3,
};

export const PREMIUM_PLANS = [PREMIUM_MONTHLY_PLAN, PREMIUM_QUARTERLY_PLAN];

/** Économie de l'offre 3 mois par rapport au mensuel, en % arrondi (33). */
export const QUARTERLY_SAVING_PERCENT = Math.round((1 - PREMIUM_QUARTERLY_PLAN.monthlyPrice / PREMIUM_MONTHLY_PLAN.monthlyPrice) * 100);

export function findPremiumPlan(priceId: string | null | undefined) {
  return PREMIUM_PLANS.find((plan) => plan.priceId === priceId) ?? null;
}
