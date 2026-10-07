import "server-only";

import Stripe from "stripe";

import { isPremiumStatus } from "./subscription";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

// Paiement du Premium avec Stripe (abonnement mensuel, Stripe Checkout + portail client).
//   STRIPE_SECRET_KEY      clé secrète (serveur uniquement)
//   STRIPE_PRICE_ID        prix récurrent du Premium (8 €/mois)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (/api/stripe/webhook)
// Le statut Premium est enregistré dans la table "subscriptions" (migration 0014) par le
// webhook, et dès le retour de Checkout (sans attendre le webhook).

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && isAdminConfigured());
}

export class StripeConfigError extends Error {}

let client: Stripe | null = null;

/** Client Stripe, créé à la première utilisation (la clé peut manquer au build). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeConfigError("STRIPE_SECRET_KEY manquante.");
  client ??= new Stripe(key);
  return client;
}

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

// ---------------------------------------------------------------------------
// Checkout et portail client
// ---------------------------------------------------------------------------

/** URL de paiement Stripe Checkout de l'abonnement Premium. */
export async function createCheckoutUrl({
  userId,
  email,
  customerId,
  origin,
}: {
  userId: string;
  email: string | null;
  /** Client Stripe d'un abonnement précédent, réutilisé. */
  customerId: string | null;
  origin: string;
}): Promise<string> {
  const price = process.env.STRIPE_PRICE_ID;
  if (!price) throw new StripeConfigError("STRIPE_PRICE_ID manquant.");

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,
    ...(customerId ? { customer: customerId } : email ? { customer_email: email } : {}),
    // Retrouver l'utilisateur depuis les événements de l'abonnement (résiliation…).
    subscription_data: { metadata: { user_id: userId } },
    // Case obligatoire avant le bouton de paiement : renonciation au droit de rétractation
    // (accès immédiat au service). Stripe exige une URL de conditions d'utilisation dans
    // Dashboard > Paramètres > Informations publiques ; l'acceptation est enregistrée dans
    // la session (consent.terms_of_service = "accepted").
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message:
          "Je renonce expressément à mon droit de rétractation de 14 jours en demandant l'accès immédiat au service Premium.",
      },
    },
    locale: "fr",
    success_url: `${origin}/dashboard?premium=bienvenue&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/premium`,
  });
  if (!session.url) throw new Error("Session Stripe Checkout sans URL.");
  return session.url;
}

/** URL du portail client Stripe (moyen de paiement, factures, résiliation). */
export async function createPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

// ---------------------------------------------------------------------------
// Synchronisation de l'abonnement (webhook, retour de Checkout)
// ---------------------------------------------------------------------------

/**
 * Enregistre l'état d'un abonnement Stripe pour son utilisateur (client service_role :
 * l'abonnement vient de l'API Stripe, jamais du navigateur).
 */
export async function syncSubscription(subscription: Stripe.Subscription, userIdHint?: string | null) {
  const supabase = createAdminClient();
  const customerId = idOf(subscription.customer);

  let userId = userIdHint || subscription.metadata?.user_id || null;
  if (!userId && customerId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    console.error("[stripe] abonnement sans utilisateur", subscription.id);
    return;
  }

  // Un ancien abonnement qui se termine ne doit pas écraser un abonnement plus récent.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== subscription.id &&
    !isPremiumStatus(subscription.status)
  ) {
    return;
  }

  const periodEnd = Math.max(0, ...subscription.items.data.map((item) => item.current_period_end ?? 0));
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Enregistrement de l'abonnement impossible : ${error.message}`);
}

/**
 * Enregistre l'abonnement créé par une session Checkout terminée. `expectedUserId` :
 * la session doit appartenir à cet utilisateur (retour de Checkout dans le navigateur).
 */
export async function syncCheckoutSession(sessionId: string, expectedUserId?: string): Promise<boolean> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  const userId = session.client_reference_id;
  if (session.mode !== "subscription" || session.status !== "complete" || !userId) return false;
  if (expectedUserId && userId !== expectedUserId) return false;

  const subscription = session.subscription;
  if (!subscription || typeof subscription === "string") return false;
  await syncSubscription(subscription, userId);
  return true;
}

/** Résilie immédiatement l'abonnement en cours (suppression du compte). */
export async function cancelSubscriptionNow(subscriptionId: string) {
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch (error) {
    // Déjà résilié côté Stripe : rien à faire.
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return;
    throw error;
  }
}
