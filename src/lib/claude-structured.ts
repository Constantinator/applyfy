import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { modelFor, supportsServerFallback, type ClaudeFunction } from "./claude-models";

// Appel structuré à Claude, sans clé ni client : le client est passé par l'appelant (claude.ts,
// qui lit la clé de l'application côté serveur ; banc d'essai du coach, avec sa propre clé).

/**
 * Appel structuré commun : sortie JSON validée par un schéma zod, avec le modèle de la fonction,
 * sur le client donné (celui de claude.ts dans l'application).
 * - effort "low" par défaut : tâches courtes d'extraction / de synthèse ;
 * - fallbacks "default" (sauf Haiku) : si le modèle décline la requête, l'API la rejoue
 *   automatiquement sur un modèle de repli adapté.
 */
export async function parseStructured<T extends z.ZodType>(
  client: Anthropic,
  fn: ClaudeFunction,
  schema: T,
  system: string,
  userContent: string | Anthropic.Beta.BetaContentBlockParam[],
  { effort = "low", maxTokens = 8000 }: { effort?: "low" | "medium"; maxTokens?: number } = {},
): Promise<z.infer<T> | null> {
  const model = modelFor(fn);
  const response = await client.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    ...(supportsServerFallback(model) && { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    output_config: { effort, format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    const details = response.stop_details;
    console.error(`[claude] ${fn} : refus du modèle ${response.model}`, details?.category ?? "?", details?.explanation ?? "");
    throw new ClaudeRefusalError(fn);
  }
  if (response.stop_reason === "max_tokens") {
    console.error(`[claude] ${fn} : limite de ${maxTokens} tokens atteinte (${response.model})`);
    return null;
  }
  return (response.parsed_output as z.infer<T> | null) ?? null;
}

/** Le modèle a refusé de traiter la demande (stop_reason « refusal »), y compris après le repli. */
export class ClaudeRefusalError extends Error {
  constructor(fn: ClaudeFunction) {
    super(`Refus du modèle (${fn})`);
    this.name = "ClaudeRefusalError";
  }
}
