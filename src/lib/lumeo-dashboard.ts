// Bandeau de Lumeo sur le Tableau de bord (fonctions pures, testables) : un seul message à la
// fois, choisi par priorité, jamais pour la candidature exemple. « Plus tard » et la carte de la
// première candidature sont mémorisés dans le navigateur (localStorage), lu par le composant.
import { buildTodo } from "./dashboard-todo";
import { daysSince } from "./follow-up";
import { LUMEO_DASHBOARD_TEXTS as T } from "./lumeo-texts";
import type { Application } from "./types";

export type LumeoDashboardMessage =
  | { kind: "bienvenue" }
  | { kind: "premiere"; applicationId: string }
  | { kind: "objectif"; sent: number; goal: number }
  | { kind: "relance"; applicationId: string; company: string; days: number };

export type LumeoDashboardInput = {
  /** Dernier CV : null s'il n'y en a pas, undefined si la lecture a échoué (pas de bandeau « sans CV »). */
  hasCv: boolean | undefined;
  applications: Application[];
  /** Envoyées cette semaine : null si la lecture a échoué. */
  weekSent: number | null;
  weeklyGoal: number | null;
  now: Date;
};

/** Message prioritaire, ou null (aucun bandeau). */
export function pickLumeoMessage({ hasCv, applications, weekSent, weeklyGoal, now }: LumeoDashboardInput): LumeoDashboardMessage | null {
  // 1. Compte sans CV (lecture réussie seulement : pas de « Crée ton CV » trompeur).
  if (hasCv === false) return { kind: "bienvenue" };

  const real = applications.filter((app) => !app.is_example);

  // 2. Première candidature envoyée.
  if (real.length === 1 && real[0].status === "envoyee") return { kind: "premiere", applicationId: real[0].id };

  // 3. Objectif de la semaine presque atteint (au moins un envoi : jamais « 0 candidature »).
  if (weeklyGoal !== null && weekSent !== null && weekSent >= 1 && weekSent === weeklyGoal - 1) {
    return { kind: "objectif", sent: weekSent, goal: weeklyGoal };
  }

  // 4. Relance : la même que la première ligne de « À faire » (attente la plus longue).
  const first = buildTodo(applications, now).find((item) => item.kind === "relance");
  const app = first && real.find((candidate) => candidate.id === first.id);
  if (first && app) {
    const days = daysSince(app.last_contact_at ?? app.applied_at, now) ?? 0;
    return { kind: "relance", applicationId: app.id, company: app.company, days };
  }

  return null;
}

/** Préfixe des clés du navigateur (lues aussi par LUMEO_PREPAINT_SCRIPT). */
export const LUMEO_STORAGE_PREFIX = "applyfy:lumeo:";

/**
 * Clé du navigateur, par message : une autre relance n'est pas masquée par la première, et la
 * carte verte est liée à sa candidature (un autre compte sur le même navigateur la verra aussi).
 */
export function lumeoMessageKey(message: LumeoDashboardMessage): string {
  if (message.kind === "relance") return `relance-${message.applicationId}`;
  if (message.kind === "premiere") return `premiere-${message.applicationId}`;
  return message.kind;
}

/** Message montré une seule journée (marque « vue » enregistrée au premier affichage). */
export const isShownOnce = (message: LumeoDashboardMessage) => message.kind === "premiere";

/** Carte verte fermée par « Plus tard » : masquée pour de bon. */
export const LUMEO_CLOSED = "fermee";

/** Valeur enregistrée par « Plus tard » : fermeture définitive pour la carte verte, le jour sinon. */
export function lumeoLaterValue(message: LumeoDashboardMessage, today: string): string {
  return isShownOnce(message) ? LUMEO_CLOSED : today;
}

/** Jour local (YYYY-MM-DD) : « Plus tard » vaut jusqu'à minuit, heure du navigateur. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Bandeau masqué ? `stored` : valeur enregistrée pour ce message (null si aucune).
 * Carte verte : visible toute la journée du premier affichage, masquée à partir du lendemain
 * (ou dès qu'elle est fermée). Sinon : masqué le jour du « Plus tard ».
 */
export function isLumeoHidden(message: LumeoDashboardMessage, stored: string | null, today: string): boolean {
  if (stored === null) return false;
  return isShownOnce(message) ? stored !== today : stored === today;
}

export type LumeoBannerContent = {
  expression: "salue" | "felicite" | "content" | "neutre";
  tone: "neutral" | "success";
  title: string;
  detail: string;
  primary: { label: string; href: string };
  /** Bienvenue : second lien (« J'ai déjà un CV ») ; « Plus tard » devient un lien texte discret. */
  secondary: { label: string; href: string } | null;
};

/** Textes, expression et liens du bandeau. */
export function lumeoBannerContent(message: LumeoDashboardMessage): LumeoBannerContent {
  switch (message.kind) {
    case "bienvenue":
      return {
        expression: "salue",
        tone: "neutral",
        title: T.bienvenue.title,
        detail: T.bienvenue.detail,
        primary: { label: T.bienvenue.primary, href: "/cv-builder" },
        secondary: { label: T.bienvenue.secondary, href: "/cv-builder/importer" },
      };
    case "premiere":
      return {
        expression: "felicite",
        tone: "success",
        title: T.premiere.title,
        detail: T.premiere.detail,
        primary: { label: T.premiere.primary, href: `/candidatures/${message.applicationId}` },
        secondary: null,
      };
    case "objectif":
      return {
        expression: "content",
        tone: "neutral",
        title: T.objectif.title(message.sent),
        detail: T.objectif.detail,
        primary: { label: T.objectif.primary, href: "/offres" },
        secondary: null,
      };
    case "relance":
      return {
        expression: "neutre",
        tone: "neutral",
        title: T.relance.title(message.company, message.days),
        detail: T.relance.detail,
        primary: { label: T.relance.primary, href: `/candidatures/${message.applicationId}#relance` },
        secondary: null,
      };
  }
}

/**
 * Script lancé avant l'affichage (layout racine) : masque tout de suite un bandeau déjà vu ou
 * remis à plus tard, pour que la page ne saute pas. Mêmes règles que isLumeoHidden ; le
 * composant prend le relais une fois chargé.
 */
export const LUMEO_PREPAINT_SCRIPT = `try{var d=new Date(),z=function(n){return(n<10?"0":"")+n},t=d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate()),p=${JSON.stringify(LUMEO_STORAGE_PREFIX)},c="";for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||k.indexOf(p)!==0)continue;var m=k.slice(p.length);if(!/^[a-z0-9-]+$/i.test(m))continue;var v=localStorage.getItem(k);if(m.indexOf("premiere-")===0?v!==t:v===t)c+='[data-lumeo-key="'+m+'"]{display:none}'}if(c){var s=document.createElement("style");s.textContent=c;document.head.appendChild(s)}}catch(e){}`;
