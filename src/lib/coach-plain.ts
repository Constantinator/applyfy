import type { CoachLang } from "./coach-outcome";

// Texte affiché du coach sans jargon (lot « corrections après le run ») : les termes techniques
// des points à corriger du score (« verbe d'action en tête », « mots-clés ATS », « (+6 pts) »,
// « formule à éviter ») sont remplacés par des mots simples. Seulement le texte affiché au
// candidat (message, annonce, pistes écrites par le serveur) : jamais le contenu du CV, ni un
// passage cité entre guillemets (une puce du CV), ni un texte proposé.

const FR: [RegExp, string][] = [
  [/n'a ni verbe d'action ni chiffre/gi, "ne dit pas ce que tu as fait concrètement et n'a pas de chiffre"],
  [/(n'a pas de|n'a aucun) verbe d'action( fort)?( en tête| au début)?/gi, "ne dit pas ce que tu as fait concrètement"],
  [/ne commence pas par un verbe d'action( fort)?/gi, "ne dit pas ce que tu as fait concrètement"],
  [/ne commencent pas par un verbe d'action( fort)?/gi, "ne disent pas ce que tu as fait concrètement"],
  [/sans verbe d'action( fort)?( en tête| au début)?/gi, "qui ne disent pas ce que tu as fait concrètement"],
  [/avec un verbe d'action( fort)?/gi, "en disant ce que tu as fait concrètement"],
  [/par un verbe d'action( fort)?/gi, "par ce que tu as fait concrètement"],
  [/des verbes d'action( forts)?/gi, "des mots qui disent ce que tu as fait"],
  [/un verbe d'action( fort)?/gi, "un mot qui dit ce que tu as fait"],
  [/verbes? d'action/gi, "action concrète"],
  [/mots-clés ATS/gi, "mots-clés du métier"],
  [/\bscore ATS\b/gi, "score"],
  [/formules à éviter/gi, "formules trop vagues"],
  [/formule à éviter/gi, "formule trop vague"],
];
const EN: [RegExp, string][] = [
  [/(doesn't|does not) (start|begin) with an action verb/gi, "doesn't say what you actually did"],
  [/(don't|do not) (start|begin) with an action verb/gi, "don't say what you actually did"],
  [/(without|with no) (an )?action verbs?/gi, "that don't say what you actually did"],
  [/with an action verb/gi, "saying what you actually did"],
  [/action verbs?/gi, "concrete action"],
  [/ATS keywords/gi, "job keywords"],
  [/\bATS score\b/gi, "score"],
];

/** Passages cités : « … », “…”, "…" (une puce du CV, un texte proposé). */
const QUOTED = /(«[^»]*»|“[^”]*”|"[^"]*")/;

/** Texte affiché du coach sans jargon ; les passages cités entre guillemets restent intacts. */
export function plainCoachText(text: string, lang: CoachLang = "fr"): string {
  const rules = lang === "en" ? [...EN, ...FR] : FR;
  return text
    .split(QUOTED)
    .map((part, i) => {
      if (i % 2 === 1) return part; // passage cité
      let out = part.replace(/\s*\(\+\d+ pts?\)/g, "");
      for (const [pattern, replacement] of rules) out = out.replace(pattern, replacement);
      return out;
    })
    .join("");
}
