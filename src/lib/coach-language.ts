import type { CoachLang } from "./coach-outcome";
import type { CvData } from "./cv-builder-types";
import { cvLanguage, detectLanguage } from "./cv-language";

export { cvLanguage, detectLanguage };

// Langue du coach du CV Builder : messages dans la langue du candidat, contenu du CV dans la
// langue du CV. Détection simple par mots outils (français, anglais) ; en cas de doute (message
// trop court, « ok »), la langue du CV.

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
