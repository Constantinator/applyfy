// Écran « Bravo » de la phase guidée : le ton suit le score du CV (le même que dans l'éditeur).
import { READY_SCORE } from "./cv-score";

/**
 * « bravo » : CV prêt à postuler (score au seuil READY_SCORE ou plus) ; « debut » : en dessous,
 * ou score indisponible (jamais de félicitations sans le savoir).
 */
export type BravoTone = "bravo" | "debut";

export function bravoTone(score: number | null | undefined): BravoTone {
  return typeof score === "number" && Number.isFinite(score) && score >= READY_SCORE ? "bravo" : "debut";
}
