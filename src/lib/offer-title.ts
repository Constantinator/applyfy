// Mots-clés d'un intitulé de poste (fonctions pures) : recherche recommandée de « Trouver une
// offre » et « Offres pour toi » du tableau de bord.

/** Mentions sans intérêt pour la recherche : « (H/F) », « F/H », « - CDI », parenthèses… */
const TITLE_NOISE = /\(.*?\)|\[.*?\]|\b[hfm]\s*\/\s*[hfm]\b|\b(cdi|cdd|stage|stagiaire|alternance|alternant|apprentie?|freelance)\b/gi;

/**
 * Intitulé allégé, 5 mots au plus : sans mentions annexes, et seulement sa première partie
 * (« Data Analyst – Équipe Paiement » → « Data Analyst » ; « Stage - Chargé de marketing »
 * → « Chargé de marketing »).
 */
function cleanTitle(title: string) {
  const parts = title
    .replace(TITLE_NOISE, " ")
    .split(/\s[-–—|]\s|[|•·]/)
    .map((part) =>
      part
        .replace(/[,;:/\\]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[-–—\s]+|[-–—\s]+$/g, ""),
    )
    .filter((part) => part.length >= 2);
  return (parts[0] ?? "").split(" ").slice(0, 5).join(" ");
}

/**
 * Métiers dont le nom n'a de sens qu'en entier (« community manager » ≠ « community ») :
 * gardés tels quels avant le retrait des mots génériques.
 */
const COMPOUND_JOBS =
  /\b(community|product|project|account|office|key account|traffic|brand|category) manager\b|\bproduct owner\b|\bchef de (projet|produit|rayon|chantier|cuisine|partie)\b|\bbusiness developer\b/i;

/** Mots qui ne disent rien du métier : niveau, fonction d'encadrement, mots outils. */
const GENERIC_WORDS = new Set([
  "manager",
  "responsable",
  "chef",
  "charge",
  "chargee",
  "junior",
  "senior",
  "confirme",
  "confirmee",
  "experimente",
  "experimentee",
  "lead",
  "head",
  "principal",
  "h",
  "f",
  "de",
  "du",
  "des",
  "d",
  "la",
  "le",
  "les",
  "l",
  "en",
  "et",
  "a",
  "au",
  "aux",
  "pour",
  "sur",
  "of",
  "the",
  "and",
]);

/** Nombre maximum de mots-clés d'un intitulé. */
const MAX_KEYWORDS = 3;

const withoutAccents = (word: string) => word.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Termes pertinents d'un intitulé, 3 au plus, en minuscules : « Marketing Manager » →
 * [marketing], « Data Analyst » → [data, analyst], « Chargé de marketing digital » →
 * [marketing, digital], « Community Manager » → [community manager] (d'un seul tenant).
 */
export function titleTerms(title: string): string[] {
  const cleaned = cleanTitle(title).toLowerCase();
  const compound = cleaned.match(COMPOUND_JOBS)?.[0];
  if (compound) return [compound];

  const words = cleaned.split(" ").map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, ""));
  const relevant = words.filter((word) => word.length > 0 && !GENERIC_WORDS.has(withoutAccents(word)));
  // Intitulé fait uniquement de mots génériques (« Responsable ») : on le garde tel quel.
  return (relevant.length > 0 ? relevant : words.filter(Boolean)).slice(0, MAX_KEYWORDS);
}

/** Mots-clés de recherche d'un intitulé : « Chargé de marketing digital » → « marketing digital ». */
export const titleKeywords = (title: string) => titleTerms(title).join(" ");
