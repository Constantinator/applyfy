import "server-only";

import { requireUser } from "./auth";
import {
  AI_USAGE_KINDS,
  FREE_MONTHLY_LIMIT,
  type AiUsage,
  type AiUsageCount,
  type AiUsageKind,
} from "./ai-usage-limits";
import { demoStore } from "./demo-data";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Compteurs d'utilisation de l'IA (table "usage", migration 0011). Une ligne par action
// réussie, rattachée au mois en cours (heure de Paris) : le changement de mois remet
// les compteurs à zéro sans traitement planifié.

const periodFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Europe/Paris",
});

/** Mois en cours (heure de Paris) et 1er du mois suivant, au format YYYY-MM-DD. */
function currentPeriod(now = new Date()) {
  const parts = periodFormatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    period: `${year}-${pad(month)}-01`,
    resetsOn: `${next.year}-${pad(next.month)}-01`,
  };
}

/** Le plan gratuit est pour l'instant le seul : tout le monde a les mêmes limites. */
function monthlyLimit(): number {
  return FREE_MONTHLY_LIMIT;
}

/** Compteurs du mode démo (en mémoire), remis à zéro quand le mois change. */
function demoCounts(period: string) {
  if (demoStore.aiUsage?.period !== period) {
    demoStore.aiUsage = { period, counts: { resume_offre: 0, adaptation_cv: 0, lettre: 0 } };
  }
  return demoStore.aiUsage.counts;
}

/** Utilisation du mois en cours de l'utilisateur connecté, pour chaque type d'action. */
export async function getAiUsage(): Promise<AiUsage> {
  const { period, resetsOn } = currentPeriod();
  const limit = monthlyLimit();
  const counts = { resume_offre: 0, adaptation_cv: 0, lettre: 0 } satisfies Record<AiUsageKind, number>;

  if (!isSupabaseConfigured()) {
    Object.assign(counts, demoCounts(period));
  } else {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usage")
      .select("kind")
      .eq("user_id", user.id)
      .eq("period", period);
    if (error) throw new Error(`Lecture de l'utilisation impossible : ${error.message}`);
    for (const row of data as { kind: AiUsageKind }[]) {
      if (row.kind in counts) counts[row.kind] += 1;
    }
  }

  const entries = AI_USAGE_KINDS.map((kind) => [kind, { used: counts[kind], limit }] as const);
  return { counts: Object.fromEntries(entries) as Record<AiUsageKind, AiUsageCount>, resetsOn };
}

/**
 * Comme getAiUsage, sans échec : si les compteurs sont illisibles (migration 0011 non
 * appliquée…), ils valent 0 et les actions restent autorisées. L'erreur est journalisée.
 */
export async function readAiUsage(): Promise<AiUsage> {
  try {
    return await getAiUsage();
  } catch (error) {
    console.error("[aiUsage] lecture", error);
    const limit = monthlyLimit();
    const entries = AI_USAGE_KINDS.map((kind) => [kind, { used: 0, limit }] as const);
    return {
      counts: Object.fromEntries(entries) as Record<AiUsageKind, AiUsageCount>,
      resetsOn: currentPeriod().resetsOn,
    };
  }
}

/** Utilisation d'un type d'action ce mois-ci (voir readAiUsage). */
export async function getAiUsageFor(kind: AiUsageKind): Promise<AiUsageCount> {
  return (await readAiUsage()).counts[kind];
}

/**
 * Enregistre une action IA réussie. La base refuse l'ajout si la limite est déjà atteinte
 * (requêtes simultanées) : l'appel à Claude a déjà eu lieu, on journalise seulement.
 */
export async function recordAiUsage(kind: AiUsageKind): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoCounts(currentPeriod().period)[kind] += 1;
    return;
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_ai_usage", { p_kind: kind });
  if (error) console.error(`[aiUsage] enregistrement (${kind})`, error.message);
}
