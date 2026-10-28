import type { Sector } from "./cv-sector-context";

// Recherche de mots-clés métier dans un texte (offres d'emploi, CV), sans la base de
// connaissance : utilisable dans le navigateur (score du CV dans l'éditeur).

/**
 * Mots-clés ambigus, comptés seulement dans leur sens métier : motif cherché dans le texte
 * normalisé (minuscules sans accents, espaces simples) à la place du mot seul. Exemples écartés,
 * relevés dans de vraies offres : « jeu vidéo » et « entretien vidéo », « à la maison »,
 * « portfolio of games », « budget dédié » (avantage salarié), « portefeuille de clients »,
 * « dette technique », « month-end closing », « at any stage », « master data ».
 */
const CONTEXTUAL_KEYWORDS: Partial<Record<Sector, Record<string, RegExp>>> = {
  finance: {
    budget:
      /(gestion|suivi|pilotage|elaboration|preparation|controle|processus|cycle|construction|exercice|revue) (du |des |de |d'|budgetaire )?budgets?|budgets? (annuels?|previsionnels?|season|process|planning|readouts?|review|vs|versus|et (forecast|previsions|reforecast))/,
    portefeuille:
      /(gestion|gerant|gestionnaire|allocation|analyse|construction|suivi) (de |du |d'un |des )?portefeuilles?(?! (de )?clients?)|portefeuilles? (d'actifs|d'investissements?|financiers?|obligataires?|de credits?|de participations|boursiers?|d'actions|titres)/,
    dette:
      /dettes? (financieres?|privees?|senior|mezzanine|bancaires?|obligataires?|d'acquisition|nettes?|structurees?)|(financement|marches?|levee|refinancement|restructuration|emission|fonds) (de |par |en )?(la )?dettes?/,
  },
  marketing: {
    pipeline: /(?<!(data|etl|ci\/cd|ci|cd|ml|build|deployment|release|donnees) )pipeline(?! (de donnees|de data|etl|ci|de deploiement))/,
  },
  creatif: {
    video:
      /(montage|monteur|monteuse|production|realisation|tournage|post-production|captation|cadreur|cadreuse|motion|contenus?|content|createur|creation|editing|editor) (de |d'|en )?videos?|videos? (editing|editor|editeur|production|content|maker|creator|marketing|motion|courtes?|short|ads?)|videaste|videographer/,
    portfolio:
      /(votre|ton|your|un|a|lien vers (votre|ton)|link to your) portfolio(?! of)|portfolio (requis|obligatoire|required|link|en ligne|online|behance|dribbble)/,
  },
  commercial: {
    pipeline: /(?<!(data|etl|ci\/cd|ci|cd|ml|build|deployment|release|donnees) )pipeline(?! (de donnees|de data|etl|ci|de deploiement))/,
    closing:
      /(?<!(month-end|year-end|monthly|annual|interview|accounting|financial|comptable) )closing(?! (with accounting|comptable|des comptes|mensuel|annuel|from))/,
    chasse: /chasse(?! de tetes| aux tetes)/,
  },
  rh: {
    formation:
      /(plan|responsable|charge|chargee|ingenierie|catalogue|budget|organisme|politique|actions?|parcours|offre|gestion|developpement) (de |du |des |de la )?formations?|formations? (professionnelles?|continues?|des collaborateurs|des salaries|internes?|des managers|obligatoires)/,
    sourcing:
      /sourcing(?! (de |des )?(matieres|fournisseurs|achats?|produits|composants|suppliers|materials))(?<!(achats?|procurement|supplier|strategic) sourcing)/,
    onboarding:
      /(?<!(customer|client|clients|merchant|user|partner|partenaire|utilisateur|kyc) )onboarding(?! (des )?(clients?|customers?|partenaires|marchands|utilisateurs|users))/,
    negociation:
      /negociations? (sociales?|collectives?|annuelles?|salariales?|d'accords?|avec les (partenaires sociaux|irp|syndicats|representants))/,
  },
  etudiant: {
    stage:
      /(?<!(any|every|each|early|late|growth|next|final|this|that|one|first|second|initial|all|different|various|later|earlier|seed)[ -])stage(?![ -]gate)/,
    master: /(?<!scrum )master(?! data| class| plan| branch| node| record)/,
  },
  luxe: {
    maison:
      /maisons? (de |d')(luxe|couture|haute couture|mode|joaillerie|parfums?|maroquinerie|horlogerie|champagne|cognac|creation)|maisons? (francaises? )?de luxe|luxury maison/,
    mode: /(?<!a la )mode(?! (projet|agile|hybride|de travail|operatoire|de fonctionnement|de paiement|degrade|avion|sombre|dark|d'emploi|de vie|de transport))/,
    "savoir-faire":
      /savoir-faire (artisanal|artisan|d'exception|unique|francais|historique|de la maison|des ateliers|manufacturier|traditionnel|d'excellence)|(son|notre|leur|ses) savoir-faire|metiers? d'art/,
    collection:
      /(plan|planning|suivi|dossier|developpement|lancement|nouvelle|capsule|chef de|responsable) (de |de la |des )?collections?|collections? (pap|homme|femme|printemps|automne|ete|hiver|capsule|couture|joaillerie|permanente|croisiere)|collection (manager|development|merchandis)/,
  },
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Texte comparable : minuscules sans accents, apostrophes droites, espaces simples, entouré d'espaces. */
export function normalizeText(text: string) {
  return ` ${text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `.replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

/** `inner` figure comme suite de mots entiers dans `outer` (textes normalisés). */
function containsWords(outer: string, inner: string) {
  return new RegExp(`(^| )${escape(inner)}( |$)`).test(outer);
}

/** L'expression (déjà normalisée) figure dans le texte normalisé, en mots entiers. */
export function hasPhrase(normalizedText: string, phrase: string) {
  const p = normalizeText(phrase).trim();
  return Boolean(p) && new RegExp(`[^a-z0-9]${escape(p)}[^a-z0-9]`).test(normalizedText);
}

/** Noms exclus (entreprise, produits), normalisés. */
function excludedNames(excluded: (string | null | undefined)[]) {
  return excluded.map((name) => normalizeText(name ?? "").trim()).filter((name) => name.length >= 2);
}

/** Le mot-clé se confond avec un nom exclu (« Datadog », « Datadog APM »…). */
export function isExcludedKeyword(keyword: string, excluded: (string | null | undefined)[]) {
  const k = normalizeText(keyword).trim();
  return excludedNames(excluded).some((name) => containsWords(name, k) || containsWords(k, name));
}

/**
 * Mots-clés de `keywords` présents dans un texte (mot entier, sans accents ni casse ; mots
 * ambigus du secteur seulement dans leur sens métier). `excluded` : nom de l'entreprise qui
 * publie l'offre et de ses produits, qui ne comptent pas (« Datadog » dans les offres de Datadog).
 */
export function matchKeywords(
  text: string,
  keywords: string[],
  sector: Sector,
  excluded: (string | null | undefined)[] = [],
): string[] {
  const haystack = normalizeText(text);
  const names = excludedNames(excluded);
  const contextual = CONTEXTUAL_KEYWORDS[sector] ?? {};
  return keywords.filter((keyword) => {
    const k = normalizeText(keyword).trim();
    if (!k || names.some((name) => containsWords(name, k) || containsWords(k, name))) return false;
    const rule = contextual[k];
    // Motif de contexte borné aux mots entiers (« mode » ne trouve pas « modéliste »).
    const pattern = rule ? new RegExp(`\\b(?:${rule.source})\\b`) : new RegExp(`[^a-z0-9]${escape(k)}[^a-z0-9]`);
    return pattern.test(haystack);
  });
}
