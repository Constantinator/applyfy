import "server-only";

import { makeCompanyDomainsReader, EMPTY_COMPANY_DOMAINS, type CompanyDomainsClient, type CompanyDomainsTable } from "@/lib/company-domains-read";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Table partagée entreprise → domaine (migration 0041), côté serveur seulement : RLS sans
// aucune règle d'accès, lue avec la clé service_role pour les seuls noms affichés à la personne
// connectée (une requête par page). Écriture : script de rattrapage (scripts/backfill-company-domains.mjs)
// par la fonction SQL upsert_company_domain ; jamais un domaine déduit d'une adresse ou d'un e-mail.

const read = makeCompanyDomainsReader((message) => console.error(message));

/** Domaines connus pour ces noms d'entreprises ; table vide si la lecture est impossible. */
export async function loadCompanyDomains(names: (string | null | undefined)[]): Promise<CompanyDomainsTable> {
  if (!isAdminConfigured()) return EMPTY_COMPANY_DOMAINS;
  return read(createAdminClient() as unknown as CompanyDomainsClient, names);
}
