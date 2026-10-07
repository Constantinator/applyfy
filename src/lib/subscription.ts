import "server-only";

import { cache } from "react";

import { getCurrentUser } from "./auth";
import { getMyBeta, hasBetaPremium } from "./beta";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Statut Premium de l'utilisateur connecté (table "subscriptions", migration 0014), tenu
// à jour par le webhook Stripe (lib/stripe). Lecture avec la session de l'utilisateur (RLS).

/**
 * Statuts Stripe donnant accès au Premium : abonnement en cours, y compris pendant les
 * nouvelles tentatives de paiement (past_due). Alignés avec is_premium (migration 0014).
 */
const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isPremiumStatus(status: string | null | undefined) {
  return Boolean(status && PREMIUM_STATUSES.has(status));
}

export type Subscription = {
  status: string;
  premium: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Fin de la période payée (ISO). */
  currentPeriodEnd: string | null;
  /** Résiliation demandée : le Premium s'arrête à currentPeriodEnd. */
  cancelAtPeriodEnd: boolean;
};

/**
 * Abonnement de l'utilisateur connecté, ou null (jamais abonné, mode démo). Sans échec :
 * si la table est illisible (migration non appliquée…), l'utilisateur est au plan gratuit.
 */
export const getSubscription = cache(async (): Promise<Subscription | null> => {
  if (!isSupabaseConfigured()) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[subscription] lecture", error.message);
    return null;
  }
  if (!data) return null;

  return {
    status: data.status,
    premium: isPremiumStatus(data.status),
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  };
});

/**
 * L'utilisateur connecté est-il Premium ? Abonnement Stripe en cours, ou beta testeur actif
 * (Premium offert jusqu'à la fin du programme). Aligné avec is_premium (migration 0017).
 */
export async function isPremium(): Promise<boolean> {
  const [subscription, beta] = await Promise.all([getSubscription(), getMyBeta()]);
  return (subscription?.premium ?? false) || hasBetaPremium(beta);
}
