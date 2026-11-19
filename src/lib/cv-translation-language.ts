import type { CvData, CvLang } from "./cv-builder-types";
import { detectLanguage } from "./cv-language";

// Langue du CONTENU du CV pour la traduction sur place et pour les titres des rubriques (lot
// « traduction sur place »). Léger (lu par l'éditeur) : aucune dépendance au score ni au coach.
// cvLanguage (cv-language.ts) reste celle du coach et du score, inchangée.

/**
 * Texte lu pour décider la langue : tous les champs traduisibles (mêmes champs, même ordre que
 * translatableFields, cv-translate.ts), jamais la photo, les coordonnées, les dates ni les noms
 * d'entreprise, d'école ou de diplôme.
 */
export function translationText(data: CvData): string {
  const parts: string[] = [data.personal.jobTitle, data.summary];
  for (const e of data.experiences) parts.push(e.position, e.location, ...e.bullets);
  for (const d of data.education) parts.push(d.honors, ...d.bullets);
  for (const s of data.skills) parts.push(s.name);
  for (const l of data.languages) parts.push(l.name, l.level);
  for (const p of data.projects) parts.push(p.description);
  parts.push(data.interests);
  return parts.map((p) => p.trim()).filter(Boolean).join(" ");
}

/** Langue du contenu ; null si elle ne peut pas être décidée (CV trop court, autant de chaque langue). */
export function cvContentLanguage(data: CvData): CvLang | null {
  return detectLanguage(translationText(data));
}

/**
 * Sens de la traduction proposée par le bouton unique : de la langue du contenu vers l'autre.
 * Null : langue du contenu indécidable (le serveur refuse alors avant le modèle, sans quota).
 */
export function translationDirection(data: CvData): { from: CvLang; to: CvLang } | null {
  const from = cvContentLanguage(data);
  if (!from) return null;
  return { from, to: from === "fr" ? "en" : "fr" };
}

/**
 * Langue des titres des rubriques et de « Aujourd'hui / Present » : celle du contenu quand elle
 * est décidable ; sinon la colonne cv_builder.language (fixée par une traduction ou un import) ;
 * sinon le français. Un ancien réglage du sélecteur contraire au contenu ne s'applique donc plus.
 */
export function cvTitleLanguage(data: CvData, stored: CvLang | null): CvLang {
  return cvContentLanguage(data) ?? stored ?? "fr";
}

/** Refus quand la langue du contenu est indécidable (avant le modèle, sans quota). */
export const TRANSLATION_TOO_SHORT =
  "Ton CV est trop court pour savoir s'il est en français ou en anglais. Ajoute ton accroche ou une expérience, puis réessaie : rien n'a été décompté.";

const LANGUAGE_NAMES: Record<CvLang, string> = { fr: "français", en: "anglais" };

/**
 * Quota de traductions du mois épuisé (compte gratuit) : message explicite, avec la date de
 * remise à zéro ; null s'il en reste ou sans quota mensuel (Premium, beta).
 */
export function translationQuotaUsed(usage: { used: number; limit: number | null }, resetLabel: string): string | null {
  if (usage.limit === null || usage.used < usage.limit) return null;
  const used = usage.limit === 1 ? "Tu as utilisé ta traduction gratuite de ce mois." : `Tu as utilisé tes ${usage.limit} traductions gratuites de ce mois.`;
  return `${used} La prochaine sera disponible le ${resetLabel}, ou tout de suite avec le Premium.`;
}

/**
 * CV lié traduit dans une autre langue que celle de l'offre : les mots-clés de l'offre (écrits
 * dans sa langue) peuvent ne plus être reconnus, le score peut baisser. Null sinon.
 */
export function offerLanguageWarning(offer: CvLang | null, to: CvLang): string | null {
  if (!offer || offer === to) return null;
  return `L'offre de cette candidature est en ${LANGUAGE_NAMES[offer]} : une fois ton CV en ${LANGUAGE_NAMES[to]}, ses mots-clés de l'offre peuvent ne plus être reconnus et ton score peut baisser.`;
}
