// Types et limites de l'adaptation de CV, partagés entre le serveur et l'interface.

export type CvSuggestions = {
  /** Synthèse en 1-2 phrases de l'adéquation entre le CV et l'offre. */
  adequation: string;
  experiences: { experience: string; pourquoi: string; conseil: string }[];
  mots_cles: { mot_cle: string; ou_l_ajouter: string }[];
  points_forts: { point: string; comment_le_valoriser: string }[];
};

/** CV enregistré dans le profil. */
export type ProfileCv = { id: string; name: string; fileName: string; uploadedAt: string };

/** Nombre maximum de CV par profil (aussi garanti par un trigger en base, migration 0007). */
export const PROFILE_CV_LIMIT = 5;
export const CV_NAME_MAX_LENGTH = 60;

/** Sous la limite de 4,5 Mo des requêtes Vercel (cf. serverActions.bodySizeLimit). */
export const CV_MAX_BYTES = 3.5 * 1024 * 1024;
export const CV_MAX_LABEL = "3,5 Mo";
