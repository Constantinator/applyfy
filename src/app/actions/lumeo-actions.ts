"use server";

import { requireUser } from "@/lib/auth";
import { isClaudeConfigured } from "@/lib/claude";
import { lumeoActionDeps } from "@/lib/lumeo-action-server";
import { executeLumeoAction, type LumeoActionOutcome } from "@/lib/lumeo-actions";
import { LUMEO_ACTION_TEXTS as T } from "@/lib/lumeo-texts";

/**
 * Clic sur « Confirmer » dans la carte de Lumeo : seul point d'entrée qui exécute une action.
 * Reçoit { type, applicationId } du navigateur et revérifie tout côté serveur (schéma strict,
 * candidature de l'utilisateur, préconditions, quotas, réservation). Le texte du modèle n'arrive
 * jamais ici. Consomme le quota de l'action seulement, jamais une question à Lumeo.
 */
export async function confirmLumeoActionAction(input: unknown): Promise<LumeoActionOutcome> {
  await requireUser();
  if (!isClaudeConfigured()) return { ok: false, message: T.failed };
  return executeLumeoAction(input, lumeoActionDeps());
}
