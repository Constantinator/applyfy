import "server-only";

import { requireUser } from "./auth";
import {
  AI_DAILY_LIMIT,
  AI_MONTHLY_LIMITS,
  AI_USAGE_KINDS,
  DAILY_LIMIT_MESSAGE,
  isLimitReached,
  LIMIT_REACHED_MESSAGE,
  RATE_LIMIT_MESSAGE,
  type AiUsage,
  type AiUsageCount,
  type AiUsageKind,
} from "./ai-usage-limits";
import { demoStore } from "./demo-data";
import { isPremium } from "./subscription";
import { createClient, isSupabaseConfigured } from "./supabase/server";

// Compteurs d'utilisation de l'IA (table "usage", migrations 0011 et 0013). Une ligne par
// action réussie, rattachée au mois en cours (heure de Paris) : le changement de mois
// remet les compteurs à zéro sans traitement planifié. Limite du jour et anti-rafale :
// migration 0020.

const periodFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Europe/Paris",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Jour (heure de Paris) d'un instant, au format YYYY-MM-DD. */
function parisDay(date: Date) {
  return dayFormatter.format(date);
}

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

function zeroCounts(): Record<AiUsageKind, number> {
  return Object.fromEntries(AI_USAGE_KINDS.map((kind) => [kind, 0])) as Record<AiUsageKind, number>;
}

/** Compteurs + limites du plan (aucune limite en Premium). */
function toUsage(
  counts: Record<AiUsageKind, number>,
  resetsOn: string,
  premium: boolean,
  usedToday = 0,
): AiUsage {
  const entries = AI_USAGE_KINDS.map(
    (kind) => [kind, { used: counts[kind] ?? 0, limit: premium ? null : AI_MONTHLY_LIMITS[kind] }] as const,
  );
  return {
    premium,
    counts: Object.fromEntries(entries) as Record<AiUsageKind, AiUsageCount>,
    usedToday,
    resetsOn,
  };
}

/** Compteurs du mode démo (en mémoire), remis à zéro quand le mois change. */
function demoCounts(period: string) {
  if (demoStore.aiUsage?.period !== period) demoStore.aiUsage = { period, counts: zeroCounts() };
  return demoStore.aiUsage.counts;
}

/** Utilisation du mois en cours de l'utilisateur connecté, pour chaque type d'action. */
export async function getAiUsage(): Promise<AiUsage> {
  const { period, resetsOn } = currentPeriod();
  const counts = zeroCounts();
  let premium = false;
  let usedToday = 0;

  if (!isSupabaseConfigured()) {
    Object.assign(counts, demoCounts(period));
  } else {
    const user = await requireUser();
    const supabase = await createClient();
    const [{ data, error }, userIsPremium] = await Promise.all([
      supabase.from("usage").select("kind, created_at").eq("user_id", user.id).eq("period", period),
      isPremium(),
    ]);
    premium = userIsPremium;
    if (error) throw new Error(`Lecture de l'utilisation impossible : ${error.message}`);
    const today = parisDay(new Date());
    for (const row of data as { kind: AiUsageKind; created_at: string }[]) {
      if (row.kind in counts) counts[row.kind] += 1;
      if (parisDay(new Date(row.created_at)) === today) usedToday += 1;
    }
  }

  return toUsage(counts, resetsOn, premium, usedToday);
}

/**
 * Comme getAiUsage, sans échec : si les compteurs sont illisibles (migration non
 * appliquée…), ils valent 0 et les actions restent autorisées. L'erreur est journalisée.
 */
export async function readAiUsage(): Promise<AiUsage> {
  try {
    return await getAiUsage();
  } catch (error) {
    console.error("[aiUsage] lecture", error);
    return toUsage(zeroCounts(), currentPeriod().resetsOn, await isPremium());
  }
}

/** Résultat d'une vérification avant un appel à Claude. */
export type AiGate = { ok: true } | AiRefusal;
type AiRefusal = { ok: false; message: string; limitReached: boolean };

/**
 * Anti-rafale (10 requêtes par minute, check_ai_rate_limit) : à appeler juste avant chaque
 * requête à Claude, qu'elle soit comptée dans « usage » ou non (import d'offre). Si la
 * vérification échoue (migration 0020 non appliquée…), la requête est autorisée.
 */
export async function checkAiRateLimit(): Promise<AiGate> {
  if (!isSupabaseConfigured()) return { ok: true };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_ai_rate_limit");
  if (!error) return { ok: true };
  if (error.code === "P0002") return { ok: false, message: RATE_LIMIT_MESSAGE, limitReached: false };
  console.error("[aiUsage] anti-rafale", error.message);
  return { ok: true };
}

/**
 * Vérifications avant une action IA comptée : limite mensuelle du plan gratuit
 * (`limitReached` : l'interface propose alors le Premium), limite du jour, puis anti-rafale.
 * Si l'action est autorisée, renvoie l'utilisation de ce type d'action avant l'appel (`count`)
 * et celle de tous les types (`usage`).
 */
export async function checkAiAccess(
  kind: AiUsageKind,
): Promise<{ ok: true; count: AiUsageCount; usage: AiUsage } | AiRefusal> {
  const usage = await readAiUsage();
  const count = usage.counts[kind];
  if (isLimitReached(count)) {
    return { ok: false, message: LIMIT_REACHED_MESSAGE, limitReached: true };
  }
  if (usage.usedToday >= AI_DAILY_LIMIT) {
    return { ok: false, message: DAILY_LIMIT_MESSAGE, limitReached: false };
  }
  const rate = await checkAiRateLimit();
  return rate.ok ? { ok: true, count, usage } : rate;
}

/**
 * Actions d'un type depuis minuit (heure de Paris) pour l'utilisateur connecté. Sans échec :
 * 0 si la lecture échoue (journalisée). Mode démo : 0.
 */
export async function countAiUsageToday(kind: AiUsageKind): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const today = parisDay(new Date());
    const { data, error } = await supabase
      .from("usage")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("kind", kind)
      .eq("period", currentPeriod().period);
    if (error) throw new Error(error.message);
    return (data as { created_at: string }[]).filter((row) => parisDay(new Date(row.created_at)) === today).length;
  } catch (error) {
    console.error(`[aiUsage] lecture du jour (${kind})`, error);
    return 0;
  }
}

/**
 * Enregistre une action IA réussie. La base refuse l'ajout si la limite est déjà atteinte
 * (requêtes simultanées) : l'appel à Claude a déjà eu lieu, on journalise seulement.
 */
export async function recordAiUsage(kind: AiUsageKind): Promise<void> {
  if (!isSupabaseConfigured()) {
    const counts = demoCounts(currentPeriod().period);
    counts[kind] = (counts[kind] ?? 0) + 1;
    return;
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_ai_usage", { p_kind: kind });
  if (error) console.error(`[aiUsage] enregistrement (${kind})`, error.message);
}
