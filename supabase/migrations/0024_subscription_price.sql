-- Deux offres Premium (src/lib/premium-plans.ts) : mensuelle (12 €/mois) et 3 mois
-- (24 € tous les 3 mois). Le prix Stripe de l'abonnement est enregistré par le webhook
-- (syncSubscription, src/lib/stripe.ts) pour calculer le MRR du tableau de bord admin.
-- Les abonnements existants le reçoivent à leur prochain événement Stripe.

alter table subscriptions add column if not exists stripe_price_id text;
