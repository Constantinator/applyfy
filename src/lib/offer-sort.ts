import type { OfferListing, OfferSort } from "@/lib/offer-types";

// Correspondance avec les mots-clés (filtre des offres des pages carrières, tri « Le plus
// pertinent ») et ordre des résultats de recherche, communs à toutes les sources.

/** Comparaison sans casse, accents ni ponctuation. */
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Termes RH français → équivalents anglais : les intitulés des pages carrières sont surtout en anglais. */
const FR_TO_EN: Record<string, string[]> = {
  "développeur": ["developer", "engineer", "software"],
  "developpeur": ["developer", "engineer", "software"],
  "ingénieur": ["engineer", "developer"],
  "ingenieur": ["engineer", "developer"],
  "designer": ["designer", "design", "ux", "ui"],
  "chef de projet": ["project manager", "product manager", "pm"],
  "product manager": ["product manager", "pm"],
  "data": ["data", "analyst", "scientist"],
  "marketing": ["marketing", "growth", "acquisition"],
  "commercial": ["sales", "account", "business development"],
  "finance": ["finance", "accounting", "financial"],
  "comptable": ["accounting", "finance", "comptroller"],
  "juridique": ["legal", "counsel", "lawyer"],
  "rh": ["hr", "human resources", "people", "recruiter"],
  "ressources humaines": ["hr", "human resources", "people"],
  "devops": ["devops", "infrastructure", "platform", "sre"],
  "cyber": ["security", "cybersecurity", "infosec"],
  "ia": ["ai", "machine learning", "ml", "artificial intelligence"],
  "intelligence artificielle": ["ai", "machine learning", "artificial intelligence"],
  "stage": ["intern", "internship"],
  "alternance": ["apprentice", "apprenticeship", "alternance"],
};

/** Dictionnaire normalisé (sans accents), les expressions les plus longues d'abord. */
const TRANSLATIONS = (() => {
  const byTerm = new Map<string, Set<string>>();
  for (const [french, english] of Object.entries(FR_TO_EN)) {
    const term = normalize(french);
    const alternatives = byTerm.get(term) ?? new Set([term]);
    for (const word of english) alternatives.add(normalize(word));
    byTerm.set(term, alternatives);
  }
  return Array.from(byTerm, ([term, alternatives]) => ({ term, alternatives: [...alternatives] })).sort(
    (a, b) => b.term.split(" ").length - a.term.split(" ").length,
  );
})();

/**
 * Terme du dictionnaire présent comme mot entier, au pluriel ou suivi d'un suffixe courant
 * (« engineer » trouve « Engineering », mais « intern » ne trouve pas « Internal », ni
 * « ui » « build »).
 */
const termPattern = (term: string) => new RegExp(`(^| )${term}(s|es|ing|ings|ship|ships)?( |$)`);

export type KeywordGroup = (text: string) => boolean;

/**
 * Mots-clés → conditions qui doivent toutes être remplies. Un terme du dictionnaire est
 * trouvé en français ou en anglais ; un autre mot, n'importe où dans le texte (comme avant).
 */
export function keywordGroups(keywords: string): KeywordGroup[] {
  let rest = ` ${normalize(keywords)} `;
  const groups: KeywordGroup[] = [];
  for (const { term, alternatives } of TRANSLATIONS) {
    if (!rest.includes(` ${term} `)) continue;
    rest = rest.replaceAll(` ${term} `, " ");
    const patterns = alternatives.map(termPattern);
    groups.push((text) => patterns.some((pattern) => pattern.test(text)));
  }
  for (const word of rest.split(" ").filter(Boolean)) groups.push((text) => text.includes(word));
  return groups;
}

const time = (offer: OfferListing) => (offer.publishedAt ? Date.parse(offer.publishedAt) : Number.NaN);

/**
 * Ordre des résultats : date de publication (les offres sans date à la fin) ou, pour
 * « pertinence », score de correspondance avec les mots-clés puis date (plus récentes
 * d'abord). Sans mots-clés, la pertinence revient au plus récent.
 */
export function compareOffers(sort: OfferSort, keywords: string): (a: OfferListing, b: OfferListing) => number {
  const direction = sort === "ancien" ? 1 : -1;
  const byDate = (a: OfferListing, b: OfferListing) => {
    const [ta, tb] = [time(a), time(b)];
    if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.isNaN(ta) ? (Number.isNaN(tb) ? 0 : 1) : -1;
    return direction * (ta - tb);
  };
  const groups = sort === "pertinence" ? keywordGroups(keywords) : [];
  if (groups.length === 0) return byDate;

  // Chaque mot-clé (ou son équivalent anglais) : 3 points dans l'intitulé, 1 ailleurs.
  const scores = new Map<OfferListing, number>();
  const score = (offer: OfferListing) => {
    let value = scores.get(offer);
    if (value === undefined) {
      const title = normalize(offer.title);
      const rest = normalize(`${offer.company ?? ""} ${offer.description}`);
      value = groups.reduce((sum, matches) => sum + (matches(title) ? 3 : matches(rest) ? 1 : 0), 0);
      scores.set(offer, value);
    }
    return value;
  };
  return (a, b) => score(b) - score(a) || byDate(a, b);
}
