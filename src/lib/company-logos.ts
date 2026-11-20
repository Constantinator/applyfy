import "server-only";

import careerCompanies from "@/lib/career-companies.json";
import { companyDomain, nameKey, withAliases, type CompanyDomainInput, type SharedDomainRow } from "@/lib/company-domain";
import { JOB_BOARD_COMPANIES } from "@/lib/job-boards";

// Adresses des logos d'entreprises (Logo.dev), calculées côté serveur : la clé publique
// LOGO_DEV_TOKEN n'est lue qu'ici. Le navigateur charge ensuite l'image directement chez
// Logo.dev (jamais relayée par notre serveur, interdit par leurs conditions).

/** Domaines vérifiés à la main (pages carrières de « Trouver une offre », entreprises collectées), plus leurs alias. */
export const KNOWN_COMPANY_DOMAINS: ReadonlyMap<string, string> = withAliases(new Map([
  ...(careerCompanies as { name: string; domain: string }[]).map((company) => [nameKey(company.name), company.domain] as const),
  ...JOB_BOARD_COMPANIES.map((company) => [nameKey(company.name), company.domain] as const),
]));

/** Tailles d'affichage du logo, en pixels. */
export type LogoSize = 36 | 44 | 48 | 56;

/**
 * Logo d'un domaine, demandé au double de la taille d'affichage (écrans haute densité), en
 * PNG (transparence). `fallback=404` : pas de monogramme généré, les initiales prennent le
 * relais. null sans clé.
 */
export function logoUrl(domain: string, size: LogoSize): string | null {
  const token = process.env.LOGO_DEV_TOKEN;
  if (!token) return null;
  const params = new URLSearchParams({ token, size: String(size * 2), format: "png", fallback: "404" });
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params}`;
}

/**
 * Logo de l'entreprise, ou null sans domaine fiable (aucune requête vers Logo.dev, initiales).
 * `shared` : lignes de la table company_domains lues une fois pour la page (loadCompanyDomains).
 */
export function companyLogo(
  input: CompanyDomainInput,
  size: LogoSize,
  shared?: ReadonlyMap<string, SharedDomainRow>,
): string | null {
  const domain = companyDomain(input, KNOWN_COMPANY_DOMAINS, shared);
  return domain && logoUrl(domain, size);
}
