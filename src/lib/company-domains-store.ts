import "server-only";

import { after } from "next/server";

import { resolveCompanyDomain, type ResolveClient } from "@/lib/company-domain-resolve";
import { makeCompanyDomainsReader, EMPTY_COMPANY_DOMAINS, type CompanyDomainsClient, type CompanyDomainsTable } from "@/lib/company-domains-read";
import { KNOWN_COMPANY_DOMAINS } from "@/lib/company-logos";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Table partagée entreprise → domaine (migration 0041), côté serveur seulement : RLS sans
// aucune règle d'accès, lue avec la clé service_role pour les seuls noms affichés à la personne
// connectée (une requête par page, 3 s au plus). Écriture : résolution en tâche de fond après la
// création d'une candidature (scheduleCompanyDomainResolution) et script de rattrapage
// (scripts/backfill-company-domains.mjs), toujours par la fonction SQL upsert_company_domain à
// partir d'un résultat de recherche Logo.dev ; jamais un domaine déduit d'une adresse ou d'un e-mail.

const log = (message: string) => console.error(message);
const read = makeCompanyDomainsReader(log);

/** Domaines connus pour ces noms d'entreprises ; table vide si la lecture est impossible ou trop lente. */
export async function loadCompanyDomains(names: (string | null | undefined)[]): Promise<CompanyDomainsTable> {
  if (!isAdminConfigured()) return EMPTY_COMPANY_DOMAINS;
  return read(createAdminClient() as unknown as CompanyDomainsClient, names);
}

/**
 * Cherche le domaine de l'entreprise APRÈS l'envoi de la réponse (`after`), depuis une action
 * serveur, une fois la candidature créée. Jamais pendant le rendu d'une page, jamais bloquant :
 * toute erreur (Logo.dev, base, planification) est seulement journalisée, sans secret.
 */
export function scheduleCompanyDomainResolution(company: string): void {
  try {
    const secretKey = process.env.LOGO_DEV_SECRET_KEY;
    if (!secretKey || !isAdminConfigured() || !company.trim()) return;
    after(async () => {
      try {
        await resolveCompanyDomain(company, {
          client: createAdminClient() as unknown as ResolveClient,
          secretKey,
          known: KNOWN_COMPANY_DOMAINS,
          log,
        });
      } catch {
        log("[company-domains] résolution en tâche de fond impossible");
      }
    });
  } catch {
    log("[company-domains] tâche de fond non planifiée");
  }
}
