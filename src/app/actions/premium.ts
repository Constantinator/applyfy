"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { findPremiumPlan } from "@/lib/premium-plans";
import { createCheckoutUrl, createPortalUrl, isStripeConfigured } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

/** Adresse du site d'où vient la demande (production, preview ou local). */
async function requestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/**
 * « Passer au Premium » : redirige vers Stripe Checkout pour l'offre de prix `priceId`
 * (à lier au formulaire : `startCheckoutAction.bind(null, plan.priceId)`).
 */
export async function startCheckoutAction(priceId: string) {
  const user = await requireUser();
  if (!isStripeConfigured()) redirect("/premium?erreur=config");
  // Seuls les prix des offres Premium sont acceptés (l'argument vient du navigateur).
  const plan = findPremiumPlan(priceId);
  if (!plan) redirect("/premium?erreur=paiement");

  const subscription = await getSubscription();
  if (subscription?.premium) redirect("/profil");
  // Beta testeur actif : le Premium est déjà offert, pas de paiement.
  if (hasBetaPremium(await getMyBeta())) redirect("/premium");

  let url: string;
  try {
    url = await createCheckoutUrl({
      priceId: plan.priceId,
      userId: user.id,
      email: user.email,
      customerId: subscription?.stripeCustomerId ?? null,
      origin: await requestOrigin(),
    });
  } catch (error) {
    console.error("[premium] checkout", error);
    redirect("/premium?erreur=paiement");
  }
  redirect(url);
}

/** « Gérer mon abonnement » : redirige vers le portail client Stripe. */
export async function openBillingPortalAction() {
  await requireUser();
  const customerId = (await getSubscription())?.stripeCustomerId;
  if (!customerId || !isStripeConfigured()) redirect("/profil?abonnement=indisponible");

  let url: string;
  try {
    url = await createPortalUrl(customerId, `${await requestOrigin()}/profil`);
  } catch (error) {
    console.error("[premium] portail", error);
    redirect("/profil?abonnement=indisponible");
  }
  redirect(url);
}
