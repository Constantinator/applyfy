import "server-only";

import { createClient } from "@supabase/supabase-js";

// Client Supabase « service_role » : contourne la RLS et voit les données de TOUS les
// utilisateurs. Réservé aux tâches serveur sans utilisateur connecté (cron des rappels,
// webhook Stripe), à l'enregistrement de l'abonnement Premium (lib/stripe, à partir de
// données relues dans l'API Stripe) et à la suppression de son propre compte
// (lib/account-deletion, limitée à l'id vérifié par requireUser). Ne jamais l'utiliser
// ailleurs dans une page ou une action déclenchée par un utilisateur.

export function isAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
