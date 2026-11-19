import type { CvLang } from "./cv-builder-types";
import type { TranslatableField, TranslationOutput } from "./cv-translate";

// Faux traducteur pour l'essai de bout en bout en développement (la clé locale est refusée) : il
// remplace les mots outils (articles, prépositions, conjonctions) par ceux de l'autre langue et
// garde tout le reste tel quel (nombres, noms propres, marqueurs). Actif SEULEMENT avec
// CV_TRANSLATE_FAKE=1 ET NODE_ENV=development : jamais en production (Next fixe NODE_ENV au build).

/** Faux traducteur autorisé : variable explicite et serveur de développement, rien d'autre. */
export function fakeTranslatorEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CV_TRANSLATE_FAKE === "1" && env.NODE_ENV === "development";
}

const FR_TO_EN: Record<string, string> = {
  le: "the", la: "the", les: "the", des: "of the", du: "of the", de: "of", et: "and", pour: "for", avec: "with",
  dans: "in", sur: "on", est: "is", que: "that", qui: "that", ce: "this", cette: "this", pas: "not", mon: "my",
  ma: "my", mes: "my", par: "per", en: "in", au: "to the", aux: "to the",
};
const EN_TO_FR: Record<string, string> = {
  the: "le", and: "et", of: "de", for: "pour", with: "avec", in: "dans", on: "sur", is: "est", that: "que",
  this: "ce", not: "pas", my: "mon", per: "par", to: "à", a: "un", an: "un",
};

/** Un texte « traduit » : mots outils remplacés, casse de la première lettre gardée. */
export function fakeTranslateText(text: string, target: CvLang): string {
  const table = target === "en" ? FR_TO_EN : EN_TO_FR;
  return text.replace(/[A-Za-zÀ-ÿ']+/g, (word) => {
    const swap = table[word.toLowerCase()];
    if (!swap) return word;
    return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() ? swap[0].toUpperCase() + swap.slice(1) : swap;
  });
}

/** Réponse au format du modèle (chemins recopiés, même ordre). */
export async function fakeTranslation(fields: TranslatableField[], target: CvLang): Promise<TranslationOutput> {
  return { fields: fields.map((f) => ({ path: f.path, text: fakeTranslateText(f.text, target) })) };
}
