// Types et limites de l'adaptation de CV, partagés entre le serveur et l'interface.

/** Groupes de mots-clés de l'offre. */
export const KEYWORD_GROUPS = [
  { id: "technique", label: "Compétences techniques" },
  { id: "comportementale", label: "Compétences comportementales" },
  { id: "mise_en_avant", label: "Mots mis en avant par l'offre" },
] as const;
export type KeywordGroup = (typeof KEYWORD_GROUPS)[number]["id"];

/** Mot-clé de l'offre, écrit comme dans l'offre ; `weight` : importance (répétitions, intitulé). */
export type OfferKeyword = { keyword: string; group: KeywordGroup; variants: string[]; weight: number };

/** Taux de correspondance des mots-clés à atteindre, en %. */
export const KEYWORD_MATCH_TARGET = 75;

/**
 * Analyse d'offre de « Adapter mon CV » : mots-clés de l'offre (comparés au CV par le code,
 * cv-keyword-match.ts), conseils courts et titre de CV proposé. `cvText` : texte du PDF
 * analysé, pour la comparaison quand la candidature n'a pas de CV amélioré.
 */
export type CvSuggestions = {
  kind: "keywords";
  keywords: OfferKeyword[];
  /** Mots-clés ignorés par l'utilisateur (retirés du calcul). */
  ignored: string[];
  conseils: string[];
  titre_cv: string;
  cvText: string | null;
};

/** Analyse enregistrée avant les mots-clés : deux listes de points (plus produite, seulement lue). */
export type LegacyCvSuggestions = {
  kind: "legacy";
  /** Points forts du profil pour ce poste. */
  ce_qui_matche: string[];
  /** Mots-clés et compétences de l'offre à ajouter au CV. */
  ce_qui_manque: string[];
};

export type SavedCvSuggestions = CvSuggestions | LegacyCvSuggestions;

/** Texte du CV conservé avec l'analyse. */
export const CV_TEXT_MAX_LENGTH = 20_000;

/** Formats plus anciens encore : « points forts / mots-clés ». */
type OlderCvSuggestions = {
  points_forts?: { point: string }[];
  mots_cles?: { mot_cle: string; ou_l_ajouter?: string }[];
};

const strings = (list: unknown) =>
  Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];

function readKeyword(value: unknown): OfferKeyword | null {
  if (!value || typeof value !== "object") return null;
  const k = value as Partial<OfferKeyword>;
  if (typeof k.keyword !== "string" || !k.keyword.trim()) return null;
  const group = KEYWORD_GROUPS.some((g) => g.id === k.group) ? (k.group as KeywordGroup) : "technique";
  const weight = typeof k.weight === "number" && Number.isFinite(k.weight) && k.weight > 0 ? k.weight : 1;
  return { keyword: k.keyword, group, variants: strings(k.variants), weight };
}

/**
 * Lit une analyse enregistrée (JSON en base), quel que soit son format : les anciens formats
 * sont lus comme deux listes de points. Retourne null si le contenu est inexploitable.
 */
export function readCvSuggestions(raw: unknown): SavedCvSuggestions | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CvSuggestions> & Partial<Omit<LegacyCvSuggestions, "kind">> & OlderCvSuggestions;

  if (Array.isArray(value.keywords)) {
    return {
      kind: "keywords",
      keywords: value.keywords.map(readKeyword).filter((k): k is OfferKeyword => k !== null),
      ignored: strings(value.ignored),
      conseils: strings(value.conseils),
      titre_cv: typeof value.titre_cv === "string" ? value.titre_cv : "",
      cvText: typeof value.cvText === "string" ? value.cvText : null,
    };
  }
  if (Array.isArray(value.ce_qui_matche) || Array.isArray(value.ce_qui_manque)) {
    return { kind: "legacy", ce_qui_matche: strings(value.ce_qui_matche), ce_qui_manque: strings(value.ce_qui_manque) };
  }
  if (Array.isArray(value.points_forts) || Array.isArray(value.mots_cles)) {
    return {
      kind: "legacy",
      ce_qui_matche: (value.points_forts ?? []).map((p) => p.point).filter(Boolean),
      ce_qui_manque: (value.mots_cles ?? []).map((m) => m.mot_cle).filter(Boolean),
    };
  }
  return null;
}

/** CV enregistré dans le profil. */
export type ProfileCv = { id: string; name: string; fileName: string; uploadedAt: string };

/** Nombre maximum de CV par profil (aussi garanti par un trigger en base, migration 0007). */
export const PROFILE_CV_LIMIT = 5;
export const CV_NAME_MAX_LENGTH = 60;

/** Sous la limite de 4,5 Mo des requêtes Vercel (cf. serverActions.bodySizeLimit). */
export const CV_MAX_BYTES = 3.5 * 1024 * 1024;
export const CV_MAX_LABEL = "3,5 Mo";

/** Résumé de profil saisi à la main (lettre de motivation sans CV). */
export const PROFILE_SUMMARY_MIN = 40;
export const PROFILE_SUMMARY_MAX = 4000;

/** Longueur maximale d'une demande dans « Affiner avec l'IA ». */
export const REFINE_MESSAGE_MAX_LENGTH = 1000;
