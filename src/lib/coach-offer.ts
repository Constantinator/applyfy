import { detectLanguage } from "./coach-language";
import type { CoachLang } from "./coach-outcome";
import type { CvData } from "./cv-builder-types";
import { cvTitleMismatch, detectOfferSector } from "./cv-sector-context";
import type { Sector } from "./sectors";

// CV lié à une offre (lot « CV lié à l'offre ») : étapes d'adaptation à l'offre, traitées avant
// les points à corriger, dans un ordre fixé par le serveur (le modèle rédige seulement). Une
// étape est proposée dans un message du coach, puis résolue à l'échange suivant (le candidat
// accepte ou refuse) ; l'écart avec l'offre est seulement dit, une fois. Les étapes faites sont
// notées par des marqueurs fixes dans les points abandonnés (renvoyés par l'éditeur et
// enregistrés avec la conversation) ; jamais pour un CV libre.

export const OFFER_STEPS = ["titre", "resume", "ecart"] as const;
export type OfferStep = (typeof OFFER_STEPS)[number];

const MARKER_PREFIX = "offre:";
export const offerMarker = (step: OfferStep) => `${MARKER_PREFIX}${step}`;
export const isOfferMarker = (point: string) => OFFER_STEPS.some((step) => point === offerMarker(step));
export const withoutOfferMarkers = (points: string[]) => points.filter((point) => !isOfferMarker(point));
/** Étapes déjà faites, d'après les marqueurs. */
export const doneOfferSteps = (points: string[]) => new Set<OfferStep>(OFFER_STEPS.filter((step) => points.includes(offerMarker(step))));

/**
 * Points abandonnés bornés aux `max` plus récents ; les marqueurs des étapes sont gardés à part
 * (sans marqueur, exactement `points.slice(-max)`).
 */
export function boundSkipped(points: string[], max: number): string[] {
  const markers = [...new Set(points.filter(isOfferMarker))];
  const rest = withoutOfferMarkers(points).slice(-max);
  return markers.length ? [...markers, ...rest] : rest;
}

/**
 * Écart principal entre le CV et l'offre, décidé par le serveur :
 * - « metier » : le candidat a au moins un poste professionnel (hors stage, alternance,
 *   apprentissage et job étudiant) dont le métier est reconnu, et aucun de ces postes n'est du
 *   secteur de l'offre (O02 : analyste crédit pour une offre de développeur ; O03 : commercial) ;
 *   un étudiant ou un stagiaire n'a pas encore de métier : jamais d'écart « metier » (O04) ;
 * - « competences » : il manque au moins GAP_SKILLS_MIN mots-clés spécifiques de l'offre ;
 * - null : écart faible.
 */
export type OfferGap = "metier" | "competences";
export const GAP_SKILLS_MIN = 3;

/** Poste d'étudiant : stage, alternance, apprentissage, job étudiant (français, anglais). */
// Bornes en lettres Unicode : « \b » ne voit pas le début de « Étudiant ».
const STUDENT_POSITION = /(?<![\p{L}\d])(stage|stagiaire|alternan(t|te|ce)|apprenti(e|ssage)?|[ée]tudiant(e)?|job [ée]tudiant|intern(ship)?|trainee|apprentice|working student)(?![\p{L}\d])/iu;
export const isStudentPosition = (position: string) => STUDENT_POSITION.test(position);

/** Métiers reconnus des postes professionnels du CV (hors postes d'étudiant). */
export function professionalSectors(data: Pick<CvData, "experiences">): Sector[] {
  return data.experiences
    .filter((e) => !isStudentPosition(e.position))
    .map((e) => detectOfferSector(e.position))
    .filter((s): s is Sector => s !== null && s !== "etudiant");
}

/** Étudiant ou stagiaire : titre d'étudiant, ou aucun poste professionnel. */
export function isStudentProfile(data: Pick<CvData, "experiences" | "personal">): boolean {
  return isStudentPosition(data.personal.jobTitle) || !data.experiences.some((e) => !isStudentPosition(e.position));
}

export function offerGap(data: Pick<CvData, "experiences">, sector: Sector, missingSpecific: number): OfferGap | null {
  if (sector !== "etudiant") {
    const sectors = professionalSectors(data);
    if (sectors.length && !sectors.includes(sector)) return "metier";
  }
  return missingSpecific >= GAP_SKILLS_MIN ? "competences" : null;
}

/** Étapes nécessaires pour ce CV et le secteur de l'offre, dans leur ordre (CV pas encore clos). */
/** Titre d'étudiant générique, sans domaine (« Étudiant », « Stagiaire », « Candidat »). */
const GENERIC_STUDENT_TITLE = /^(etudiante?|stagiaire|candidate?|alternante?|apprentie?|student|intern|trainee|candidate|apprentice)$/;
const plainTitle = (title: string) =>
  title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
export const isGenericStudentTitle = (title: string) => GENERIC_STUDENT_TITLE.test(plainTitle(title));
/** Titre d'étudiant ou de stagiaire qui nomme déjà son domaine (« Étudiant en informatique ») : honnête, rien à proposer. */
export const isStudentTitleWithDomain = (title: string) => isStudentPosition(title) && !isGenericStudentTitle(title);

/**
 * Étapes nécessaires pour ce CV et le secteur de l'offre, dans leur ordre (CV pas encore clos).
 * Titre : vide, générique (« Étudiant », « Stagiaire »), ou d'un autre métier que l'offre ; jamais
 * pour un écart « metier » (ce serait mentir) ni pour un titre d'étudiant qui nomme déjà son
 * domaine d'études (rien d'honnête à proposer : O04).
 */
export function offerSteps(data: Pick<CvData, "personal">, sector: Sector, gap: OfferGap | null = null): OfferStep[] {
  const steps: OfferStep[] = [];
  const title = data.personal.jobTitle.trim();
  const needsTitle = !title || isGenericStudentTitle(title) || (cvTitleMismatch(title, sector) && !isStudentTitleWithDomain(title));
  if (gap !== "metier" && needsTitle) steps.push("titre");
  // Résumé orienté offre : proposé une fois par session.
  steps.push("resume");
  // Écart dit une fois, avec la réponse au résumé ; omis quand il est faible.
  if (gap) steps.push("ecart");
  return steps;
}

/**
 * Étape de l'échange : `resolve`, l'étape proposée au message précédent, à laquelle le candidat
 * répond ; `propose`, l'étape à proposer dans ce message ; `sayGap`, l'écart à dire dans ce
 * message (champ « ecart_offre »), sans question.
 */
export type OfferStage = { resolve: ProposedStep | null; propose: ProposedStep | null; sayGap: boolean };
/** Étapes proposées au candidat (l'écart est seulement dit). */
export type ProposedStep = Exclude<OfferStep, "ecart">;

/**
 * Étape de l'échange, décidée par le serveur. `opening` : premier message du coach (rien n'a
 * encore été proposé). Plus aucune étape après « plus de questions ».
 */
export function offerStage(steps: OfferStep[], done: Set<OfferStep>, { opening, stopAll }: { opening: boolean; stopAll: boolean }): OfferStage | null {
  if (stopAll) return null;
  const remaining = steps.filter((step) => !done.has(step));
  if (!remaining.length) return null;
  // L'écart n'est pas une proposition : il est dit avec la réponse à l'étape qui le précède.
  const first = remaining[0];
  if (first === "ecart") return opening ? null : { resolve: null, propose: null, sayGap: true };
  if (opening) return { resolve: null, propose: first, sayGap: false };
  const next = remaining[1] ?? null;
  return { resolve: first, propose: next === "ecart" ? null : next, sayGap: next === "ecart" };
}

/** Langue de l'offre (intitulé et description) ; null si elle ne peut pas être décidée. */
export function offerLanguage(application: { position?: string | null; offer_description?: string | null; offer_summary?: string | null }): CoachLang | null {
  return detectLanguage([application.position ?? "", application.offer_description ?? application.offer_summary ?? ""].join(" "));
}

const LANGUAGE_NAMES: Record<CoachLang, Record<CoachLang, string>> = {
  fr: { fr: "français", en: "anglais" },
  en: { fr: "French", en: "English" },
};

/**
 * Offre et CV dans deux langues différentes : une phrase fixe du serveur, dans la langue du
 * candidat, qui propose la traduction sans la faire ; null sinon.
 */
export function offerLanguageNote(offer: CoachLang | null | undefined, cv: CoachLang | undefined, lang: CoachLang = "fr"): string | null {
  if (!offer || !cv || offer === cv) return null;
  const name = LANGUAGE_NAMES[lang];
  return lang === "en"
    ? `The job offer is in ${name[offer]} while your CV is in ${name[cv]}: if you like, I can translate your CV, just ask.`
    : `L'offre est en ${name[offer]} alors que ton CV est en ${name[cv]} : si tu veux, je peux traduire ton CV, il suffit de me le demander.`;
}

/** Premier message du coach précédé, s'il y a lieu, de la phrase sur la langue de l'offre (dite une seule fois). */
export function withOfferLanguageNote(message: string, context: { offerLanguage?: CoachLang | null; cvLanguage?: CoachLang; language?: CoachLang }): string {
  const note = offerLanguageNote(context.offerLanguage, context.cvLanguage, context.language);
  return note ? `${note} ${message}` : message;
}

/** Contexte du coach réduit à ce qui décide l'étape (coach-prompt.ts, coach-turn.ts). */
export type OfferStageInput = { offerSteps?: OfferStep[]; skipped?: string[]; listening?: { stopAll: boolean } };

/** Étape de l'échange pour ce contexte ; null pour un CV libre ou sans étape restante. */
export function offerStageOf(context: OfferStageInput, opening: boolean): OfferStage | null {
  if (!context.offerSteps) return null;
  return offerStage(context.offerSteps, doneOfferSteps(context.skipped ?? []), { opening, stopAll: context.listening?.stopAll ?? false });
}

/**
 * Marqueurs à ajouter après l'échange : l'étape résolue l'est en mode parcours, quelle que soit
 * la réponse (acceptée, refusée ou sans réponse : proposée une seule fois). Une demande explicite
 * du candidat la laisse en attente. L'écart est fait s'il a été dit (`gapSaid`) ; resté vide, il
 * est redemandé une fois, puis abandonné pour ne pas bloquer le parcours.
 */
export function offerMarkersAfter(stage: OfferStage | null, mode: "demande" | "parcours", gapSaid = false): string[] {
  if (!stage) return [];
  const done: OfferStep[] = [];
  if (stage.resolve && mode === "parcours") done.push(stage.resolve);
  if (stage.sayGap && (gapSaid || (!stage.resolve && mode === "parcours"))) done.push("ecart");
  return done.map(offerMarker);
}
