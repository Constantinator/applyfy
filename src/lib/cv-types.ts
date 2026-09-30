// Types et limites de l'adaptation de CV, partagés entre le serveur et l'interface.

/** Suggestions d'adaptation du CV : deux listes de points courts (une ligne chacun). */
export type CvSuggestions = {
  /** Points forts du profil pour ce poste. */
  ce_qui_matche: string[];
  /** Mots-clés et compétences de l'offre à ajouter au CV. */
  ce_qui_manque: string[];
};

/** Format enregistré avant la version « Ce qui matche / Ce qui manque ». */
type LegacyCvSuggestions = {
  points_forts?: { point: string }[];
  mots_cles?: { mot_cle: string; ou_l_ajouter?: string }[];
};

/**
 * Lit des suggestions enregistrées (JSON en base), quel que soit leur format :
 * l'ancien format est converti. Retourne null si le contenu est inexploitable.
 */
export function readCvSuggestions(raw: unknown): CvSuggestions | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CvSuggestions> & LegacyCvSuggestions;
  const strings = (list: unknown) =>
    Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];

  if (Array.isArray(value.ce_qui_matche) || Array.isArray(value.ce_qui_manque)) {
    return { ce_qui_matche: strings(value.ce_qui_matche), ce_qui_manque: strings(value.ce_qui_manque) };
  }
  if (Array.isArray(value.points_forts) || Array.isArray(value.mots_cles)) {
    return {
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
