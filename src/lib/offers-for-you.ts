// « Offres pour toi » du tableau de bord (fonctions pures, testables) : offres en base, du secteur
// du dernier CV, dont le titre reprend le poste visé.
import { hasPhrase, normalizeText } from "./keyword-match";
import { parseOfferLink } from "./offer-limits";
import { titleTerms } from "./offer-title";

export const OFFERS_FOR_YOU_COUNT = 3;
/** Sans date d'expiration en base : au-delà, l'offre a de bonnes chances d'être pourvue. */
export const OFFERS_MAX_AGE_DAYS = 30;

const DAY = 86_400_000;

export type JobOfferRow = {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
  scraped_at: string;
};
export type OfferForYou = { id: string; title: string; company: string; url: string };

/** Offres déjà ajoutées par l'utilisateur, à ne pas reproposer. */
export type AppliedOffer = { company: string; position: string; offer_url: string | null };

/** Date limite de collecte (ISO) des offres retenues. */
export const offersCutoff = (now: Date) => new Date(now.getTime() - OFFERS_MAX_AGE_DAYS * DAY).toISOString();

const offerKey = (company: string, title: string) => `${normalizeText(company).trim()}|${normalizeText(title).trim()}`;

/**
 * Les 3 offres les plus proches du poste visé (plus de termes communs, puis plus récentes), ou
 * aucune s'il y en a moins de 3 : mieux vaut pas de bloc qu'une liste trop faible.
 */
export function pickOffersForYou(rows: JobOfferRow[], targetJob: string, applied: AppliedOffer[], now: Date): OfferForYou[] {
  const terms = titleTerms(targetJob);
  if (!terms.length) return [];

  const cutoff = offersCutoff(now);
  const appliedUrls = new Set(applied.map((app) => app.offer_url).filter(Boolean));
  const seen = new Set(applied.map((app) => offerKey(app.company, app.position)));

  const matches = rows.flatMap((row) => {
    const company = row.company?.trim();
    const title = row.title.trim();
    const url = parseOfferLink(row.url);
    if (!company || !title || !url || row.scraped_at < cutoff || appliedUrls.has(url)) return [];
    const normalized = normalizeText(title);
    const matched = terms.filter((term) => hasPhrase(normalized, term)).length;
    return matched > 0 ? [{ offer: { id: row.id, title, company, url }, matched, scrapedAt: row.scraped_at }] : [];
  });

  matches.sort((a, b) => b.matched - a.matched || b.scrapedAt.localeCompare(a.scrapedAt));

  const offers: OfferForYou[] = [];
  for (const { offer } of matches) {
    const key = offerKey(offer.company, offer.title);
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push(offer);
    if (offers.length === OFFERS_FOR_YOU_COUNT) return offers;
  }
  return [];
}

/** Fiche d'import pré-remplie à partir du lien de l'offre. */
export const offerImportHref = (url: string) => `/candidatures/nouvelle?lien=${encodeURIComponent(url)}`;
