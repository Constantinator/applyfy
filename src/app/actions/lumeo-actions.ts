"use server";

import { countAiUsageToday, readAiUsage } from "@/lib/ai-usage";
import { requireUser } from "@/lib/auth";
import { isClaudeConfigured } from "@/lib/claude";
import { lumeoActionDeps, lumeoProposal } from "@/lib/lumeo-action-server";
import { executeLumeoAction, parseLumeoActionRequest, type LumeoActionOutcome, type LumeoProposal, type LumeoRefusal } from "@/lib/lumeo-actions";
import { lumeoMockEnabled } from "@/lib/lumeo-mock";
import { LUMEO_ACTION_TEXTS as T } from "@/lib/lumeo-texts";

/**
 * Clic sur « Confirmer » dans la carte de Lumeo : seul point d'entrée qui exécute une action.
 * Reçoit { type, applicationId } du navigateur et revérifie tout côté serveur (schéma strict,
 * candidature de l'utilisateur, préconditions, quotas, réservation). Le texte du modèle n'arrive
 * jamais ici. Consomme le quota de l'action seulement, jamais une question à Lumeo.
 */
export async function confirmLumeoActionAction(input: unknown): Promise<LumeoActionOutcome> {
  await requireUser();
  if (!lumeoMockEnabled() && !isClaudeConfigured()) return { ok: false, message: T.failed };
  return executeLumeoAction(input, lumeoActionDeps());
}

/**
 * Bouton « Améliorer avec Lumeo » de la boîte « Relancer » : construit la carte de confirmation
 * depuis la base, sans appel au modèle ni décompte. Rien ne s'exécute ici ; la confirmation (1
 * question à Lumeo, après réussite) passe par confirmLumeoActionAction.
 */
export async function proposeRelanceAction(applicationId: unknown): Promise<{ ok: true; proposal: LumeoProposal } | LumeoRefusal> {
  await requireUser();
  if (!lumeoMockEnabled() && !isClaudeConfigured()) return { ok: false, message: T.failed };
  const request = parseLumeoActionRequest({ type: "relance", applicationId, origin: "box" });
  if (!request) return { ok: false, message: T.invalid };
  try {
    const [usage, coachToday] = await Promise.all([readAiUsage(), countAiUsageToday("cvb_coach")]);
    return await lumeoProposal(request, { premium: usage.premium, counts: usage.counts, usedToday: usage.usedToday, coachToday });
  } catch (error) {
    console.error("[lumeo relance] proposition", error instanceof Error ? error.message : "erreur inconnue");
    return { ok: false, message: T.failed };
  }
}
