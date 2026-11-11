// Réglages du banc d'essai : modèles, prix, limites. Le coach utilise le modèle de l'application
// (modelFor, avec la surcharge CLAUDE_MODEL_COACH s'il y en a une) : on mesure ce qui tourne en vrai.
import { modelFor } from "../../src/lib/claude-models.ts";

export const MODELS = {
  /** Coach : le modèle de l'application pour coachBuilderCv (et coachOpening, même groupe). */
  coach: modelFor("coachBuilderCv"),
  /** Faux candidat : modèle rapide, il ne fait que jouer une persona. */
  simulator: process.env.EVAL_SIMULATOR_MODEL?.trim() || "claude-haiku-5-5",
  /** Juge : plus fort que le coach ; il ne voit jamais le prompt du coach. */
  judge: process.env.EVAL_JUDGE_MODEL?.trim() || "claude-opus-5-5",
} as const;

/** Prix en dollars par million de tokens (entrée, sortie), tarifs publics de l'API. */
export const PRICES_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-fable-5-2": { input: 8, output: 40 },
};
/** Modèle inconnu (repli serveur vers un autre modèle, par exemple) : compté au prix le plus haut. */
export const UNKNOWN_PRICE_USD = { input: 10, output: 50 };

export function priceOf(model: string) {
  return PRICES_USD[model] ?? UNKNOWN_PRICE_USD;
}

/** Conversion dollars → euros (réglable : EVAL_USD_EUR). */
export const USD_TO_EUR = Number(process.env.EVAL_USD_EUR) > 0 ? Number(process.env.EVAL_USD_EUR) : 0.92;

export const DEFAULTS = {
  /** Messages du faux candidat par conversation, au plus. */
  maxTurns: 10,
  /** Lancements de chaque scénario (variance). */
  repeat: 3,
  /** Tours accordés après le passage à 80, pour vérifier que le coach ne repose pas de question. */
  turnsAfterClosure: 2,
};

/** Hypothèses de l'estimation avant lancement (remplacées par les mesures du premier vrai run). */
export const ESTIMATE = {
  /** Tours moyens par conversation, en proportion du maximum. */
  turnShare: 0.6,
  /** Part des réponses du coach qui demandent un second essai. */
  retryRate: 0.25,
  /** Tokens de sortie moyens (réflexion comprise). */
  coachOutput: 800,
  openingOutput: 300,
  simulatorInput: 3000,
  simulatorOutput: 300,
  judgeOutput: 1500,
  /** Caractères par token (texte français et JSON). */
  charsPerToken: 3.2,
};
