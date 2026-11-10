// Panneau global de Lumeo (fonctions pures, testables) : page courante, suggestions, règles de
// quota, contexte minimal envoyé à Claude, protection contre l'injection et liens autorisés.
// Lumeo conseille et oriente ; il ne déclenche aucune action (pas d'écriture, pas de document).
import { AI_DAILY_LIMIT, CVB_COACH_DAILY_LIMIT } from "./ai-usage-limits";
import { daysSince, needsFollowUp } from "./follow-up";
import { LUMEO_PANEL_TEXTS } from "./lumeo-texts";
import { STATUS_LABELS, type Application, type ApplicationStatus } from "./types";

// ---------------------------------------------------------------------------
// Page courante
// ---------------------------------------------------------------------------

export const LUMEO_PAGES = ["fiche", "dashboard", "candidatures", "cv-builder", "offres", "autre"] as const;
export type LumeoPage = (typeof LUMEO_PAGES)[number];
export type LumeoLocation = { page: LumeoPage; applicationId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanPath(pathname: string) {
  return pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

/** Page de l'espace connecté vue par Lumeo ; la fiche porte l'id de sa candidature. */
export function lumeoLocation(pathname: string): LumeoLocation {
  const path = cleanPath(pathname);
  const fiche = /^\/candidatures\/([^/]+)(?:\/.*)?$/.exec(path);
  if (fiche && UUID.test(fiche[1])) return { page: "fiche", applicationId: fiche[1].toLowerCase() };
  if (path === "/candidatures" || path.startsWith("/candidatures/")) return { page: "candidatures", applicationId: null };
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return { page: "dashboard", applicationId: null };
  if (path === "/cv-builder" || path.startsWith("/cv-builder/")) return { page: "cv-builder", applicationId: null };
  if (path === "/offres" || path.startsWith("/offres/")) return { page: "offres", applicationId: null };
  return { page: "autre", applicationId: null };
}

/** Page de Lumeo en pleine page. */
export const LUMEO_PAGE_PATH = "/lumeo";

export function isLumeoPage(pathname: string): boolean {
  const path = cleanPath(pathname);
  return path === LUMEO_PAGE_PATH || path.startsWith(`${LUMEO_PAGE_PATH}/`);
}

/**
 * Bouton global affiché partout dans l'espace connecté, sauf dans l'éditeur plein écran du CV
 * Builder (/cv-builder/[id]), qui a déjà son onglet Lumeo, et sur la page /lumeo elle-même.
 */
export function showsLumeoButton(pathname: string): boolean {
  if (isLumeoPage(pathname)) return false;
  const editor = /^\/cv-builder\/([^/]+)/.exec(cleanPath(pathname));
  return !editor || editor[1] === "importer";
}

/**
 * « Réduire » : retour à la page d'où Lumeo a été agrandi (chemin interne, jamais /lumeo) ;
 * le Tableau de bord si /lumeo a été ouverte directement.
 */
export function lumeoReturnPath(lastPath: string | null): string {
  if (!lastPath || !lastPath.startsWith("/") || lastPath.startsWith("//") || isLumeoPage(lastPath)) return "/dashboard";
  return lastPath;
}

/** Zone de conversation lue « en bas » : à moins de `threshold` px de la fin. */
export function isNearBottom({ scrollTop, clientHeight, scrollHeight }: { scrollTop: number; clientHeight: number; scrollHeight: number }, threshold = 80): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/**
 * Défilement automatique de la page /lumeo, sans saut pendant la lecture :
 * - « bottom » : question envoyée par l'utilisateur, ou « il réfléchit » alors qu'on était en bas ;
 * - « reply » : nouvelle réponse alors qu'on était en bas → son début est amené en haut ;
 * - « none » : l'utilisateur a remonté la conversation pour relire, on ne bouge pas.
 */
export function lumeoScrollAction({
  lastRole,
  pending,
  nearBottom,
}: {
  lastRole: "user" | "assistant" | null;
  pending: boolean;
  nearBottom: boolean;
}): "bottom" | "reply" | "none" {
  if (lastRole === "user") return "bottom";
  if (!nearBottom) return "none";
  if (pending) return "bottom";
  return lastRole === "assistant" ? "reply" : "none";
}

/** Emplacement envoyé par le navigateur : revalidé côté serveur (jamais de confiance). */
export function parseLumeoLocation(value: unknown): LumeoLocation | null {
  if (!value || typeof value !== "object") return null;
  const { page, applicationId } = value as Record<string, unknown>;
  if (typeof page !== "string" || !(LUMEO_PAGES as readonly string[]).includes(page)) return null;
  if (page !== "fiche") return { page: page as LumeoPage, applicationId: null };
  return typeof applicationId === "string" && UUID.test(applicationId)
    ? { page: "fiche", applicationId: applicationId.toLowerCase() }
    : null;
}

export function lumeoSuggestions(page: LumeoPage): readonly string[] {
  return LUMEO_PANEL_TEXTS.suggestions[page];
}

// ---------------------------------------------------------------------------
// Quota : celui du coach (cvb_coach), sans nouveau compteur
// ---------------------------------------------------------------------------

export type LumeoGate = "ok" | "quota" | "daily";

/**
 * Plafond commun à tous les plans (actions IA du jour) d'abord, puis les questions du jour du
 * plan gratuit (partagées avec le coach du CV Builder). Premium et beta : pas de limite du jour.
 */
export function lumeoGate({ premium, coachToday, usedToday }: { premium: boolean; coachToday: number; usedToday: number }): LumeoGate {
  if (usedToday >= AI_DAILY_LIMIT) return "daily";
  if (!premium && coachToday >= CVB_COACH_DAILY_LIMIT) return "quota";
  return "ok";
}

export function lumeoGateMessage(gate: Exclude<LumeoGate, "ok">): string {
  return gate === "quota" ? LUMEO_PANEL_TEXTS.quota(CVB_COACH_DAILY_LIMIT) : LUMEO_PANEL_TEXTS.daily;
}

// ---------------------------------------------------------------------------
// Données : toujours neutralisées, jamais des instructions
// ---------------------------------------------------------------------------

export const LUMEO_QUESTION_MAX = 1000;
export const LUMEO_HISTORY_MAX_TURNS = 12; // 6 échanges
export const LUMEO_TURN_MAX_CHARS = 1000;
export const LUMEO_OFFER_MAX_CHARS = 4000;
export const LUMEO_APPLICATIONS_MAX = 15;

/**
 * Texte de l'utilisateur, d'une offre ou d'un CV, placé entre balises : les chevrons deviennent
 * des guillemets simples pour qu'aucune balise (fermante ou nouvelle) ne puisse en sortir, et les
 * caractères de contrôle sont retirés.
 */
export function neutralizeData(value: unknown, max = LUMEO_TURN_MAX_CHARS): string {
  const text = typeof value === "string" ? value : "";
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .trim()
    .slice(0, max);
}

export type LumeoTurn = { role: "user" | "assistant"; content: string };

/** Échanges précédents revalidés : les plus récents seulement, chacun borné. */
export function lumeoTurns(history: unknown): LumeoTurn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (t): t is LumeoTurn =>
        Boolean(t) && typeof t === "object" && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
    )
    .slice(-LUMEO_HISTORY_MAX_TURNS)
    .map(({ role, content }) => ({ role, content: content.slice(0, LUMEO_TURN_MAX_CHARS) }));
}

// ---------------------------------------------------------------------------
// Contexte minimal
// ---------------------------------------------------------------------------

export type LumeoCvInput = {
  score: number;
  weakPoints: string[];
  sector: string | null;
  targetJob: string;
  experiences: { position: string; startDate: string; endDate: string; current: boolean }[];
  skills: string[];
};

export type LumeoOfferInput = Pick<Application, "company" | "position" | "location" | "status" | "applied_at" | "last_contact_at" | "is_example"> & {
  sector?: string | null;
  offer_summary?: string | null;
  offer_description?: string | null;
};

export type LumeoContextInput = {
  location: LumeoLocation;
  firstName: string | null;
  cv: LumeoCvInput | null;
  applications: Application[];
  offer: LumeoOfferInput | null;
  now: Date;
};

const PAGE_LABELS: Record<LumeoPage, string> = {
  fiche: "la fiche d'une candidature",
  dashboard: "le Tableau de bord",
  candidatures: "la liste des candidatures",
  "cv-builder": "le CV Builder (liste des CV)",
  offres: "Trouver une offre",
  autre: "une autre page de l'appli",
};

function yearOf(value: string): number | null {
  const match = /(19|20)\d{2}/.exec(value);
  return match ? Number(match[0]) : null;
}

/**
 * Années d'expérience estimées à partir des années de début et de fin (périodes qui se
 * chevauchent comptées une fois) ; null si aucune date n'est lisible.
 */
export function experienceYears(experiences: LumeoCvInput["experiences"], now: Date): number | null {
  const years = new Set<number>();
  let readable = false;
  for (const exp of experiences) {
    const start = yearOf(exp.startDate);
    const end = exp.current ? now.getFullYear() : yearOf(exp.endDate) ?? start;
    if (start === null || end === null || end < start) continue;
    readable = true;
    // Une période d'une seule année compte pour une année ; sinon, le nombre d'années écoulées.
    for (let y = start; y < Math.max(end, start + 1); y++) years.add(y);
  }
  return readable ? years.size : null;
}

function cvBlock(cv: LumeoCvInput, now: Date): string {
  const years = experienceYears(cv.experiences, now);
  const positions = cv.experiences
    .map((e) => neutralizeData(e.position, 120))
    .filter(Boolean)
    .slice(0, 8);
  const skills = cv.skills.map((s) => neutralizeData(s, 60)).filter(Boolean).slice(0, 20);
  return [
    `Score du CV : ${Math.round(cv.score)}/100`,
    cv.targetJob ? `Poste visé : ${neutralizeData(cv.targetJob, 120)}` : null,
    cv.sector ? `Secteur du CV : ${neutralizeData(cv.sector, 60)}` : null,
    cv.weakPoints.length ? `Points faibles (calculés par Applyfy) :\n${cv.weakPoints.slice(0, 3).map((w) => `- ${neutralizeData(w, 200)}`).join("\n")}` : null,
    positions.length ? `Postes occupés : ${positions.join(" ; ")}` : null,
    years !== null ? `Années d'expérience (estimation d'après les dates du CV) : ${years}` : null,
    skills.length ? `Compétences : ${skills.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function applicationLine(app: Application, now: Date): string {
  const sent = daysSince(app.applied_at, now);
  return [
    `- ${neutralizeData(app.company, 80)} · ${neutralizeData(app.position, 120)} · ${STATUS_LABELS[app.status]}`,
    sent !== null ? ` · envoyée il y a ${sent} j` : "",
    needsFollowUp(app, now) ? " · relance en retard" : "",
  ].join("");
}

function applicationsBlock(applications: Application[], now: Date): string {
  const real = applications.filter((app) => !app.is_example);
  if (real.length === 0) return "Aucune candidature enregistrée.";
  const counts = new Map<ApplicationStatus, number>();
  for (const app of real) counts.set(app.status, (counts.get(app.status) ?? 0) + 1);
  const late = real.filter((app) => needsFollowUp(app, now)).length;
  const recent = [...real].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, LUMEO_APPLICATIONS_MAX);
  return [
    `Total : ${real.length} (${[...counts].map(([status, n]) => `${STATUS_LABELS[status]} ${n}`).join(", ")}) ; relances en retard : ${late}`,
    `Les plus récentes :`,
    ...recent.map((app) => applicationLine(app, now)),
  ].join("\n");
}

function offerBlock(offer: LumeoOfferInput, now: Date): string {
  const text = offer.offer_summary || offer.offer_description || "";
  const sent = daysSince(offer.applied_at, now);
  const contact = daysSince(offer.last_contact_at, now);
  return [
    `Entreprise : ${neutralizeData(offer.company, 80)}`,
    `Poste : ${neutralizeData(offer.position, 120)}`,
    offer.location ? `Lieu : ${neutralizeData(offer.location, 80)}` : null,
    offer.sector ? `Secteur : ${neutralizeData(offer.sector, 60)}` : null,
    `Statut : ${STATUS_LABELS[offer.status]}`,
    sent !== null ? `Envoyée il y a ${sent} jours` : "Pas encore envoyée",
    contact !== null && offer.last_contact_at !== offer.applied_at ? `Dernier contact il y a ${contact} jours` : null,
    needsFollowUp(offer as Application, now) ? "Relance en retard (7 jours sans réponse)" : null,
    text ? `Texte de l'offre :\n${neutralizeData(text, LUMEO_OFFER_MAX_CHARS)}` : "Texte de l'offre : non enregistré",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Contexte envoyé à Claude : seulement l'utile, jamais d'e-mail, de téléphone, de contact ni de notes. */
export function buildLumeoContext({ location, firstName, cv, applications, offer, now }: LumeoContextInput): string {
  const blocks = [
    `<page>\nL'utilisateur est sur ${PAGE_LABELS[location.page]}.\n</page>`,
    firstName ? `<prenom>${neutralizeData(firstName, 40)}</prenom>` : null,
    `<cv>\n${cv ? cvBlock(cv, now) : "Aucun CV dans le CV Builder."}\n</cv>`,
    `<candidatures>\n${applicationsBlock(applications, now)}\n</candidatures>`,
    location.page === "fiche"
      ? offer && !offer.is_example
        ? `<offre_ouverte>\nLien de la fiche : /candidatures/${location.applicationId}\n${offerBlock(offer, now)}\n</offre_ouverte>`
        : `<offre_ouverte>\n${offer ? "C'est la candidature exemple créée à l'inscription : fictive, ne la commente pas comme une vraie." : "Fiche introuvable."}\n</offre_ouverte>`
      : null,
  ];
  return blocks.filter(Boolean).join("\n\n");
}

/** Message envoyé à Claude : contexte, échanges précédents et question, tous comme données. */
export function lumeoUserContent(context: string, turns: LumeoTurn[], question: string): string {
  const transcript = turns
    .map((t) => `${t.role === "user" ? "Utilisateur" : "Lumeo"} : ${neutralizeData(t.content, LUMEO_TURN_MAX_CHARS)}`)
    .join("\n\n");
  return [
    `<donnees>\n${context}\n</donnees>`,
    transcript ? `<conversation>\n${transcript}\n</conversation>` : null,
    `<question>\n${neutralizeData(question, LUMEO_QUESTION_MAX)}\n</question>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Liens : seulement les pages de l'appli
// ---------------------------------------------------------------------------

const INTERNAL_LINKS = [
  /^\/dashboard$/,
  /^\/candidatures$/,
  /^\/candidatures\?filtre=a_relancer$/,
  /^\/candidatures\/nouvelle$/,
  /^\/candidatures\/[0-9a-f-]{36}(#relance)?$/i,
  /^\/cv-builder$/,
  /^\/cv-builder\/importer$/,
  /^\/offres$/,
  /^\/premium$/,
  /^\/profil$/,
];

/** Lien affiché par Lumeo : une page de l'appli de la liste blanche, sinon null (texte simple). */
export function safeLumeoHref(href: string): string | null {
  const value = href.trim();
  return INTERNAL_LINKS.some((pattern) => pattern.test(value)) ? value : null;
}
