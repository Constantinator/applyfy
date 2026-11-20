import "server-only";

import { createClient } from "@supabase/supabase-js";

// Client Supabase « service_role » : contourne la RLS et voit les données de TOUS les
// utilisateurs. Réservé aux tâches serveur sans utilisateur connecté (cron des rappels, ménage
// des fichiers d'import du CV Builder, webhook Stripe), à l'enregistrement de l'abonnement Premium (lib/stripe, à partir de
// données relues dans l'API Stripe), à la suppression de son propre compte
// (lib/account-deletion, limitée à l'id vérifié par requireUser) et au tableau de bord
// admin (lib/admin-metrics, après requireAdmin), aux offres collées versées dans les
// statistiques de mots-clés (lib/user-job-offers, sans donnée utilisateur) et à la lecture des
// offres collectées (lib/dashboard-offers, colonnes sans donnée utilisateur), ainsi qu'au cron de
// collecte des offres (app/api/cron/collecte, sans donnée utilisateur), ainsi qu'à la lecture
// des domaines d'entreprises (lib/company-domains-store, table sans règle d'accès, lue seulement
// pour les noms affichés à la personne connectée, et écrite en tâche de fond après la création
// d'une candidature, à partir d'un résultat de recherche Logo.dev, sans aucune donnée de la
// personne au-delà du nom de l'entreprise), ainsi qu'au cron des nouveaux essais de ces domaines
// (app/api/cron/domaines, noms d'entreprises seulement, bilan chiffré). Ne jamais l'utiliser ailleurs dans une page ou
// une action déclenchée par un utilisateur.

export function isAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
