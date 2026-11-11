import type { CoachLang } from "./coach-outcome";
import type { CvData } from "./cv-builder-types";

// Langue du coach du CV Builder : messages dans la langue du candidat, contenu du CV dans la
// langue du CV. Détection simple par mots outils (français, anglais) ; en cas de doute (message
// trop court, « ok »), la langue du CV.

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

/** Début d'une annonce de modification (« C'est fait », « Done ») : sa langue, même pour une phrase courte. */
const ANNOUNCE_FR = /^\s*(c['’]est fait|j['’]ai (ajouté|modifié|réécrit|raccourci|traduit|supprimé|reformulé|regroupé|déplacé|mis)|voilà)\b/i;
const ANNOUNCE_EN = /^\s*(done\b|i['’]ve\b|i have (added|updated|rewritten|shortened|translated|removed|rephrased|grouped|moved)\b|here you go\b)/i;

/**
 * Langue d'une annonce de modification écrite par le modèle : mots outils, sinon son début
 * (« C'est fait : accroche raccourcie. » n'a qu'un mot outil) ; null si rien ne permet de décider.
 */
export function announcementLanguage(text: string): CoachLang | null {
  return detectLanguage(text) ?? (ANNOUNCE_FR.test(text) ? "fr" : ANNOUNCE_EN.test(text) ? "en" : null);
}

/** Langue du contenu du CV (accroche, puces, intitulés) ; français par défaut. */
export function cvLanguage(data: Pick<CvData, "summary" | "experiences" | "personal">): CoachLang {
  const text = [data.personal.jobTitle, data.summary, ...data.experiences.flatMap((e) => [e.position, ...e.bullets])].join(" ");
  return detectLanguage(text) ?? "fr";
}

/**
 * Langue du candidat : celle de son dernier message ; en cas de doute (« ok so languages still
 * left?? »), celle de son message précédent le plus récent qui permet de décider ; sinon celle du
 * CV. Le CV seul ne suffit pas : après une traduction, il n'est plus dans la langue du candidat.
 */
export function candidateLanguage(
  lastMessage: string | null,
  data: Pick<CvData, "summary" | "experiences" | "personal">,
  previousMessages: string[] = [],
): CoachLang {
  for (const message of [lastMessage, ...[...previousMessages].reverse()]) {
    const lang = message ? detectLanguage(message) : null;
    if (lang) return lang;
  }
  return cvLanguage(data);
}
