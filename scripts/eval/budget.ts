// Compteur de dépense : coût réel de chaque appel (usage renvoyé par l'API, au prix du modèle qui a
// vraiment répondu) et arrêt avant tout appel qui pourrait dépasser le plafond (EVAL_MAX_COST_EUR).
import { ESTIMATE, priceOf, USD_TO_EUR } from "./config.ts";

export type Role = "coach" | "simulator" | "judge";

export class BudgetExceeded extends Error {
  constructor(spent: number, cap: number) {
    super(`Plafond atteint : ${spent.toFixed(2)} € dépensés sur ${cap.toFixed(2)} €`);
    this.name = "BudgetExceeded";
  }
}

export type BudgetState = {
  capEur: number;
  spentEur: number;
  /** Pire coût des appels en cours (conversations en parallèle) : compté avant le plafond. */
  reservedEur: number;
  calls: number;
  byRole: Record<Role, { calls: number; inputTokens: number; outputTokens: number; eur: number }>;
  byModel: Record<string, number>;
};

export function newBudget(capEur: number): BudgetState {
  const zero = () => ({ calls: 0, inputTokens: 0, outputTokens: 0, eur: 0 });
  return { capEur, spentEur: 0, reservedEur: 0, calls: 0, byRole: { coach: zero(), simulator: zero(), judge: zero() }, byModel: {} };
}

export function costEur(model: string, inputTokens: number, outputTokens: number) {
  const price = priceOf(model);
  return ((inputTokens * price.input + outputTokens * price.output) / 1_000_000) * USD_TO_EUR;
}

/** Pire coût d'un appel : son entrée estimée et toute la limite de sortie. */
export function worstCaseEur(model: string, params: { system?: unknown; messages?: unknown; max_tokens?: number }) {
  const chars = JSON.stringify(params.system ?? "").length + JSON.stringify(params.messages ?? []).length;
  return costEur(model, chars / ESTIMATE.charsPerToken, params.max_tokens ?? 16000);
}

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export function record(budget: BudgetState, role: Role, model: string, usage: Usage | undefined) {
  const input = (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  const output = usage?.output_tokens ?? 0;
  const eur = costEur(model, input, output);
  budget.spentEur += eur;
  budget.calls++;
  const r = budget.byRole[role];
  r.calls++;
  r.inputTokens += input;
  r.outputTokens += output;
  r.eur += eur;
  budget.byModel[model] = (budget.byModel[model] ?? 0) + 1;
}

/** Client minimal utilisé par le banc d'essai (sous-ensemble du SDK Anthropic). */
export type ParseClient = {
  beta: { messages: { parse: (params: Record<string, unknown>) => Promise<Record<string, unknown>> } };
};

/**
 * Client compté : chaque appel est refusé d'avance s'il pouvait dépasser le plafond (dépense,
 * appels en cours et son pire coût), puis son coût réel est ajouté. Le coût suit le modèle qui a répondu (`response.model`, repli serveur compris).
 */
export function meteredClient<T extends ParseClient>(client: T, budget: BudgetState, role: Role): T {
  const parse = async (params: Record<string, unknown>) => {
    const model = String(params.model);
    const worst = worstCaseEur(model, params);
    if (budget.spentEur + budget.reservedEur + worst > budget.capEur) throw new BudgetExceeded(budget.spentEur, budget.capEur);
    budget.reservedEur += worst;
    try {
      const response = await client.beta.messages.parse(params);
      record(budget, role, String(response.model ?? model), response.usage as Usage | undefined);
      return response;
    } finally {
      budget.reservedEur -= worst;
    }
  };
  return { ...client, beta: { ...client.beta, messages: { ...client.beta.messages, parse } } } as T;
}
