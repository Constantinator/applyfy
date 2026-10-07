import type Stripe from "stripe";

import { getStripe, isStripeConfigured, syncCheckoutSession, syncSubscription } from "@/lib/stripe";

// Webhook Stripe (Dashboard Stripe > Développeurs > Webhooks), URL :
// https://<domaine>/api/stripe/webhook. Événements écoutés :
//   checkout.session.completed      paiement réussi → Premium
//   customer.subscription.updated   changement de statut (impayé, résiliation programmée…)
//   customer.subscription.deleted   abonnement terminé → retour au plan gratuit
// Chaque appel est authentifié par sa signature (STRIPE_WEBHOOK_SECRET).

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !isStripeConfigured()) {
    return Response.json({ error: "Stripe non configuré" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(payload, request.headers.get("stripe-signature") ?? "", secret);
  } catch (error) {
    console.error("[stripe/webhook] signature invalide", error instanceof Error ? error.message : error);
    return Response.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncCheckoutSession(event.data.object.id);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
    }
  } catch (error) {
    // Erreur 500 : Stripe renverra l'événement plus tard.
    console.error(`[stripe/webhook] ${event.type}`, error);
    return Response.json({ error: "Traitement impossible" }, { status: 500 });
  }

  return Response.json({ received: true });
}
