// Titre d'un poste tel qu'on l'écrit dans un message (relance, Lumeo) : sans « H/F », sans durée,
// avec le bon article. Fonctions pures ; le titre enregistré en base ne change jamais.

const DURATION = String.raw`\d+\s*(?:mois|ans?|semaines?)`;

/** Titre du poste sans « H/F », « (F/H) », « H/F/X », durée (« - 6 mois », « (6 mois) ») ni tirets en trop. */
export function cleanPosition(position: string): string {
  const cleaned = position
    .replace(/\(?\b[HFX]\s*\/\s*[HFX](?:\s*\/\s*[HFX])?\b\)?/gi, "")
    .replace(new RegExp(String.raw`\(\s*${DURATION}\s*\)`, "gi"), "")
    .replace(new RegExp(String.raw`\s*[-–—|]\s*${DURATION}\b`, "gi"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/(?:\s*[-–—|]\s*)+$/g, "")
    .replace(/^(?:\s*[-–—|]\s*)+/g, "")
    .replace(/\s+[-–—|]\s+(?:[-–—|]\s+)+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Inutilisable (aucune lettre, ex. « H/F » seul) : vide.
  return /\p{L}/u.test(cleaned) ? cleaned : "";
}

/** « h » muet courant en début de métier (hôtesse, huissier, horloger, hébergement…). */
const H_MUET = /^h(?:ab|é|e(?:rb|ur)|ist|om|on|ô|or|ui|um|yd|yg|yp)/iu;
const VOWEL = /^[aeiouyàâäéèêëîïôöùûü]/iu;

/** Article devant le titre : « d' » devant voyelle (accentuée ou non) ou « h » muet, sinon « de ». */
export function positionArticle(title: string): "d'" | "de " {
  return VOWEL.test(title) || H_MUET.test(title) ? "d'" : "de ";
}

/** « au poste d'Analyste financier » / « au poste de Chargé de marketing » ; vide si titre inutilisable. */
export function atPosition(position: string): string {
  const title = cleanPosition(position);
  return title ? `au poste ${positionArticle(title)}${title}` : "";
}
