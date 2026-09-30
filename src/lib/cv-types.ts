// Types et limites de l'adaptation de CV, partagés entre le serveur et l'interface.

export type CvSuggestions = {
  /** Synthèse en 1-2 phrases de l'adéquation entre le CV et l'offre. */
  adequation: string;
  experiences: { experience: string; pourquoi: string; conseil: string }[];
  mots_cles: { mot_cle: string; ou_l_ajouter: string }[];
  points_forts: { point: string; comment_le_valoriser: string }[];
};

/** Sous la limite de 4,5 Mo des requêtes Vercel (cf. serverActions.bodySizeLimit). */
export const CV_MAX_BYTES = 3.5 * 1024 * 1024;
export const CV_MAX_LABEL = "3,5 Mo";
