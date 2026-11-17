import type { CvData, CvLang } from "./cv-builder-types";

// Langue d'un texte et du contenu d'un CV (français, anglais), sans dépendance au coach : lue par
// l'éditeur (titres des rubriques d'un CV sans langue fixée) et par le coach (coach-language.ts).
// Détection simple par mots outils ; en cas de doute, null (texte) ou le français (CV).

const FR = new Set(
  "le la les des du de et est une un pour tu ton ta tes avec dans que qui pas sur ce cette mon ma mes je j'ai c'est oui non merci peux veux".split(" "),
);
const EN = new Set(
  "the and is you your to of for with in that it are this on my i was have yes no thanks can want please what how so just do now then done im i'm it's not but too still left all only".split(" "),
);
/** Mots outils nécessaires pour décider. */
const MIN_HITS = 2;

const words = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-zàâäçéèêëîïôöùûüÿœ']+/g) ?? [];

/** Langue d'un texte ; null si elle ne peut pas être décidée (trop court, ou autant de chaque langue). */
export function detectLanguage(text: string): CvLang | null {
  let fr = 0;
  let en = 0;
  for (const w of words(text)) {
    if (FR.has(w)) fr++;
    if (EN.has(w)) en++;
  }
  // Lettres accentuées : un indice de français en plus.
  if (/[àâçéèêëîïôûùœ]/i.test(text)) fr++;
  if (fr + en < MIN_HITS || fr === en) return null;
  return fr > en ? "fr" : "en";
}

/** Langue du contenu du CV (accroche, puces, intitulés) ; français par défaut. */
export function cvLanguage(data: Pick<CvData, "summary" | "experiences" | "personal">): CvLang {
  const text = [data.personal.jobTitle, data.summary, ...data.experiences.flatMap((e) => [e.position, ...e.bullets])].join(" ");
  return detectLanguage(text) ?? "fr";
}
