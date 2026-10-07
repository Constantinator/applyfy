import "server-only";

import { getApplications } from "./applications";
import { resolveDepartment } from "./geo";
import type { ContractFilter } from "./offer-types";

// Recommandations personnalisées de la page « Trouver une offre » : une recherche
// construite à partir des candidatures de l'utilisateur (intitulé de poste le plus
// fréquent, localisation la plus fréquente, stage ou alternance si c'est ce qui domine).

export type RecommendationBasis = {
  /** Mots-clés de la recherche (3 au plus), tirés de l'intitulé de poste le plus fréquent. */
  keywords: string;
  /** Localisation retenue (reconnue par la recherche), ou "" si aucune. */
  place: string;
  /** Stage ou alternance, si la majorité des candidatures en sont. */
  contract: ContractFilter | null;
  /** Nombre de candidatures analysées. */
  applicationCount: number;
};

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

/** Nombre maximum de mots-clés de la recherche recommandée. */
const MAX_KEYWORDS = 3;

const withoutAccents = (word: string) => word.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Mots-clés pertinents d'un intitulé, 3 au plus, en minuscules : « Marketing Manager » →
 * « marketing », « Data Analyst » → « data analyst », « Chargé de marketing digital » →
 * « marketing digital », « Community Manager » → « community manager ».
 */
function titleKeywords(title: string): string {
  const cleaned = cleanTitle(title).toLowerCase();
  const compound = cleaned.match(COMPOUND_JOBS)?.[0];
  if (compound) return compound;

  const words = cleaned.split(" ").map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, ""));
  const relevant = words.filter((word) => word.length > 0 && !GENERIC_WORDS.has(withoutAccents(word)));
  // Intitulé fait uniquement de mots génériques (« Responsable ») : on le garde tel quel.
  return (relevant.length > 0 ? relevant : words.filter(Boolean)).slice(0, MAX_KEYWORDS).join(" ");
}

/** Localisation exploitable : code de département ou nom de ville. */
function cleanLocation(location: string) {
  const text = location.trim();
  // « 69 - Lyon 3e » (format France Travail), « Paris (75) »
  const code = text.match(/^(\d{2,3}|2[ab])\s*-/i)?.[1] ?? text.match(/\((\d{2,3}|2[ab])\)/i)?.[1];
  if (code) return code;
  return text
    .split(/[,(–—]/)[0]
    .replace(/\s+\d+(e|er|ème)?$/i, "") // « Lyon 3e » → « Lyon »
    .trim();
}

/** Valeurs classées par fréquence ; à égalité, la plus récente d'abord (liste déjà triée). */
function byFrequency(values: string[]): string[] {
  const counts = new Map<string, { value: string; count: number; firstIndex: number }>();
  values.forEach((value, index) => {
    const key = value.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { value, count: 1, firstIndex: index });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map((entry) => entry.value);
}

/**
 * Base de la recherche recommandée ; null si l'utilisateur n'a aucune candidature
 * exploitable. Les brouillons sont ignorés : seules comptent les candidatures envoyées.
 */
export async function getRecommendationBasis(): Promise<RecommendationBasis | null> {
  const { applications: all } = await getApplications(); // de la plus récente à la plus ancienne
  const applications = all.filter((app) => app.status !== "brouillon");

  // Fréquence des mots-clés (et non des intitulés) : « Marketing Manager » et « Responsable
  // marketing » comptent tous deux pour « marketing ».
  const titles = byFrequency(applications.map((app) => titleKeywords(app.position)).filter((t) => t.length >= 2));
  if (titles.length === 0) return null;

  // Première localisation fréquente reconnue (3 essais au plus) ; sinon, toute la France.
  const locations = byFrequency(
    applications.map((app) => (app.location ? cleanLocation(app.location) : "")).filter((l) => l.length >= 2),
  );
  let place = "";
  for (const candidate of locations.slice(0, 3)) {
    if (await resolveDepartment(candidate)) {
      place = candidate.slice(0, 80);
      break;
    }
  }

  const share = (pattern: RegExp) =>
    applications.filter((app) => pattern.test(app.position)).length / applications.length;
  const contract: ContractFilter | null =
    share(/stag(e|iaire)/i) > 0.5 ? "stage" : share(/alternan(ce|t)|apprenti/i) > 0.5 ? "alternance" : null;

  return { keywords: titles[0].slice(0, 120), place, contract, applicationCount: applications.length };
}
