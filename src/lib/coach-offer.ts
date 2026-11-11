import type { CvData } from "./cv-builder-types";
import { cvTitleMismatch } from "./cv-sector-context";
import type { Sector } from "./sectors";

// CV lié à une offre (lot « CV lié à l'offre ») : étapes d'adaptation à l'offre, traitées avant
// les points à corriger, dans un ordre fixé par le serveur (le modèle rédige seulement). Une
// étape est proposée dans un message du coach, puis résolue à l'échange suivant (le candidat
// accepte ou refuse) ; l'écart avec l'offre est seulement dit, une fois. Les étapes faites sont
// notées par des marqueurs fixes dans les points abandonnés (renvoyés par l'éditeur et
// enregistrés avec la conversation) ; jamais pour un CV libre.

export const OFFER_STEPS = ["titre", "resume"] as const;
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

/** Étapes nécessaires pour ce CV et le secteur de l'offre, dans leur ordre (CV pas encore clos). */
export function offerSteps(data: Pick<CvData, "personal">, sector: Sector): OfferStep[] {
  const steps: OfferStep[] = [];
  const title = data.personal.jobTitle.trim();
  if (!title || cvTitleMismatch(title, sector)) steps.push("titre");
  // Résumé orienté offre : proposé une fois par session.
  steps.push("resume");
  return steps;
}

/**
 * Étape de l'échange : `resolve`, l'étape proposée au message précédent, à laquelle le candidat
 * répond ; `propose`, l'étape à proposer dans ce message.
 */
export type OfferStage = { resolve: OfferStep | null; propose: OfferStep | null };

/**
 * Étape de l'échange, décidée par le serveur. `opening` : premier message du coach (rien n'a
 * encore été proposé). Plus aucune étape après « plus de questions ».
 */
export function offerStage(steps: OfferStep[], done: Set<OfferStep>, { opening, stopAll }: { opening: boolean; stopAll: boolean }): OfferStage | null {
  if (stopAll) return null;
  const remaining = steps.filter((step) => !done.has(step));
  if (!remaining.length) return null;
  if (opening) return { resolve: null, propose: remaining[0] };
  return { resolve: remaining[0], propose: remaining[1] ?? null };
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
 * du candidat la laisse en attente.
 */
export function offerMarkersAfter(stage: OfferStage | null, mode: "demande" | "parcours"): string[] {
  if (!stage?.resolve || mode !== "parcours") return [];
  return [offerMarker(stage.resolve)];
}
