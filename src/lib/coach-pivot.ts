import type { CoachLang } from "./coach-outcome";
import type { CvData } from "./cv-builder-types";
import { detectOfferSector } from "./cv-sector-context";

// Pivot d'un CV libre (dernier lot du coach, C2) : le candidat dit dans un message qu'il vise un
// autre poste que le titre de son CV (« en fait je vise plutôt un poste de chef de projet
// événementiel », L14). Décidé par le serveur à partir des messages du candidat : le coach propose
// une fois un titre lié à la nouvelle cible, et le serveur dit l'écart une fois avant de conclure.
// Jamais pour un CV lié (l'offre fixe la cible).

/** Déclaration d'une cible : « je vise / je cherche / je veux devenir… X », « I'm targeting X ». */
const TARGET_STATEMENT =
  /\b(?:je vise|je cherche|je veux devenir|je voudrais devenir|j'aimerais devenir|je souhaite devenir|je me r[ée]oriente vers|i'?m (?:now )?(?:targeting|aiming for|looking for)|i want to become|i'?d like to become|i want to move into)\s+((?:(?:maintenant|plut[ôo]t|finalement|d[ée]sormais|en fait|now|rather|instead)\s+)*)((?:un|une|le|la) (?:poste|emploi|job|stage|alternance|m[ée]tier) (?:de |d'|en |comme )|(?:an? )?(?:role|position|job) as (?:an? )?|(?:un|une|an?) )?([^,.;:!?\n]{3,80})/giu;
/** Fin de la cible : ce qui suit est une autre idée (« … et je voudrais », « … mais »). */
const TARGET_END = /\s+(?:et|mais|pour|car|donc|parce|plutôt que|au lieu|and|but|so|because|instead of|rather than)\s.*$/iu;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Cible déclarée dans un message (la dernière du message), ou null. Elle doit désigner un métier
 * reconnu (detectOfferSector) ou suivre « un poste de » : « je vise trop haut » n'en est pas une.
 */
export function statedTarget(message: string): string | null {
  let found: string | null = null;
  for (const m of message.matchAll(TARGET_STATEMENT)) {
    const target = m[3].replace(TARGET_END, "").trim().slice(0, 60).trim();
    if (target.length < 3) continue;
    if (detectOfferSector(target) !== null || /poste|emploi|job|role|position|m[ée]tier/i.test(m[2] ?? "")) found = target;
  }
  return found;
}

/** Deux intitulés désignent le même poste (l'un contient l'autre, sans accents ni casse). */
const sameTarget = (a: string, b: string) => {
  const x = normalize(a);
  const y = normalize(b);
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
};

/** Mots de contenu d'une cible (5 lettres ou plus). */
export const targetWords = (target: string) => [...new Set(normalize(target).split(" ").filter((w) => w.replace(/'/g, "").length >= 5))];

/** Le titre du coach est-il proposé dans ce message (une question qui parle du titre) ? */
const proposesTitle = (text: string) => /\b(titre|title)\b/i.test(text) && /\?/.test(text);

/** Phrase d'écart du serveur (début fixe : sert à savoir si elle a déjà été dite). */
const GAP_START: Record<CoachLang, string> = { fr: "Pour un poste de « ", en: "For a « " };
export function pivotGapSentence(target: string, jobTitle: string, lang: CoachLang): string {
  const title = jobTitle.trim();
  return lang === "en"
    ? `${GAP_START.en}${target} » role, your CV still mostly shows ${title ? `your background as ${title}` : "your current background"}: only the experiences close to it support it.`
    : `${GAP_START.fr}${target} », ton CV montre encore surtout ${title ? `ton parcours de ${title}` : "ton parcours actuel"} : seules les expériences qui s'en rapprochent le soutiennent.`;
}

/** Pivot d'un CV libre, pour le coach (bloc situation) et le serveur (phrase d'écart). */
export type CoachPivot = {
  /** Nouvelle cible, telle que le candidat l'a écrite (60 caractères au plus). */
  target: string;
  /** Un message du coach a déjà proposé un titre depuis la déclaration. */
  titleProposed: boolean;
  /** La phrase d'écart est à dire : mots de la cible absents des postes et des puces, pas encore dite. */
  gap: boolean;
};

/**
 * Pivot d'un CV libre d'après les messages du candidat (historique, puis dernier message) : la
 * dernière cible déclarée, si elle diffère du titre du CV. Null sans déclaration, si la dernière
 * revient au titre du CV, ou pour un CV lié (`linked`).
 */
export function coachPivot(
  data: Pick<CvData, "personal" | "experiences">,
  history: { role: "user" | "assistant"; content: string }[],
  request: string | null,
  linked: boolean,
): CoachPivot | null {
  if (linked) return null;
  const turns = [...history, ...(request ? [{ role: "user" as const, content: request }] : [])];
  let target: string | null = null;
  let at = -1;
  turns.forEach((t, i) => {
    if (t.role !== "user") return;
    const stated = statedTarget(t.content);
    if (stated) {
      target = stated;
      at = i;
    }
  });
  if (!target || sameTarget(target, data.personal.jobTitle)) return null;
  const after = turns.slice(at + 1).filter((t) => t.role === "assistant").map((t) => t.content);
  const cvWords = new Set(
    normalize(data.experiences.flatMap((e) => [e.position, ...e.bullets]).join(" "))
      .split(" ")
      .filter(Boolean),
  );
  const words = targetWords(target);
  const absent = words.length > 0 && words.every((w) => !cvWords.has(w));
  const said = turns.some((t) => t.role === "assistant" && (t.content.includes(GAP_START.fr + target) || t.content.includes(GAP_START.en + target)));
  return { target, titleProposed: after.some(proposesTitle), gap: absent && !said };
}
