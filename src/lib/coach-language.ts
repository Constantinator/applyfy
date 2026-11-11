import type { CoachLang } from "./coach-outcome";
import type { CvData } from "./cv-builder-types";

// Langue du coach du CV Builder : messages dans la langue du candidat, contenu du CV dans la
// langue du CV. Détection simple par mots outils (français, anglais) ; en cas de doute (message
// trop court, « ok »), la langue du CV.

const FR = new Set(
  "le la les des du de et est une un pour tu ton ta tes avec dans que qui pas sur ce cette mon ma mes je j'ai c'est oui non merci peux veux".split(" "),
);
const EN = new Set("the and is you your to of for with in that it are this on my i was have yes no thanks can want please what how".split(" "));
/** Mots outils nécessaires pour décider. */
const MIN_HITS = 2;

const words = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-zàâäçéèêëîïôöùûüÿœ']+/g) ?? [];

/** Langue d'un texte ; null si elle ne peut pas être décidée (trop court, ou autant de chaque langue). */
export function detectLanguage(text: string): CoachLang | null {
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
export function cvLanguage(data: Pick<CvData, "summary" | "experiences" | "personal">): CoachLang {
  const text = [data.personal.jobTitle, data.summary, ...data.experiences.flatMap((e) => [e.position, ...e.bullets])].join(" ");
  return detectLanguage(text) ?? "fr";
}

/** Langue du candidat : celle de son dernier message, sinon (doute) celle du CV. */
export function candidateLanguage(lastMessage: string | null, data: Pick<CvData, "summary" | "experiences" | "personal">): CoachLang {
  return (lastMessage ? detectLanguage(lastMessage) : null) ?? cvLanguage(data);
}
