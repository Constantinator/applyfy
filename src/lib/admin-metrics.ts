import "server-only";

import { redirect } from "next/navigation";

import { AI_USAGE_KINDS, type AiUsageKind } from "./ai-usage-limits";
import { requireUser } from "./auth";
import { toFeedback } from "./feedback";
import {
  FAVORITE_FEATURES,
  MISSING_FEATURES,
  RECOMMEND_ANSWERS,
  type FavoriteFeature,
  type Feedback,
  type MissingFeature,
  type RecommendAnswer,
} from "./feedback-options";
import { isPremiumStatus } from "./subscription";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

// Tableau de bord admin (/admin) : métriques d'utilisateurs, de revenus et de coûts IA.
// Lecture de toutes les données avec le client service_role, après vérification que
// l'utilisateur connecté est l'administrateur.

export const ADMIN_EMAIL = "constantinvarin@gmail.com";

/** Prix mensuel du Premium, en euros (MRR = abonnés × prix). */
export const PREMIUM_MONTHLY_PRICE = 8;

/** Coût réel estimé d'une action IA (appel à l'API Claude), en euros. */
export const AI_ACTION_COSTS: Record<AiUsageKind, number> = {
  resume_offre: 0.02,
  adaptation_cv: 0.05,
  cv_ameliore: 0.08,
  lettre: 0.05,
  affinage_cv: 0.05,
  affinage_lettre: 0.05,
};

/**
 * Réservé à l'administrateur : email du compte connecté ET adresse confirmée (relue dans
 * Supabase Auth). Tout autre utilisateur est renvoyé vers le dashboard.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.email?.toLowerCase() !== ADMIN_EMAIL || !isAdminConfigured()) redirect("/dashboard");

  const { data, error } = await createAdminClient().auth.admin.getUserById(user.id);
  if (error || data.user.email?.toLowerCase() !== ADMIN_EMAIL || !data.user.email_confirmed_at) {
    redirect("/dashboard");
  }
  return user;
}

/** L'utilisateur connecté est-il l'administrateur ? (affichage du lien, sans vérification forte) */
export function isAdminEmail(email: string | null | undefined) {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

// ---------------------------------------------------------------------------
// Lecture des données
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createAdminClient>;

type AuthUser = { id: string; email: string | null; createdAt: string };
type UsageRow = { user_id: string; kind: AiUsageKind };
type SubscriptionRow = { user_id: string; status: string; created_at: string; updated_at: string };

const PAGE = 1000;

async function listAllUsers(supabase: AdminClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Lecture des utilisateurs impossible : ${error.message}`);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, createdAt: u.created_at })));
    if (data.users.length < PAGE) return users;
  }
}

/** Toutes les lignes d'une requête (l'API Supabase en renvoie 1 000 au plus par appel). */
async function selectAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// ---------------------------------------------------------------------------
// Dates (jours et mois, heure de Paris)
// ---------------------------------------------------------------------------

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Paris",
});

/** « 2026-10-06 » (jour à Paris). */
const parisDay = (date: Date | string) => dayFormatter.format(new Date(date));

/** Les `count` derniers jours (YYYY-MM-DD), aujourd'hui compris, du plus ancien au plus récent. */
function lastDays(count: number, now: Date): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(parisDay(new Date(now.getTime() - i * 86_400_000)));
  return [...new Set(days)];
}

// ---------------------------------------------------------------------------
// Métriques
// ---------------------------------------------------------------------------

export type DailyPoint = { day: string; value: number };

/** Compte de résultat d'un mois, en euros. */
export type ProfitBreakdown = {
  /** Revenus bruts (MRR). */
  revenue: number;
  stripeFees: number;
  aiCost: number;
  urssaf: number;
  /** Bénéfice net réel = revenus − frais Stripe − coûts IA − URSSAF. */
  net: number;
};

/** Frais Stripe par paiement mensuel : 1,5 % + 0,25 €. */
export const STRIPE_FEE_RATE = 0.015;
export const STRIPE_FEE_FIXED = 0.25;
/** Cotisations sociales de l'auto-entrepreneur : 22 % du chiffre d'affaires brut. */
export const URSSAF_RATE = 0.22;
/** Plafond annuel de la franchise en base de TVA (prestations de services). */
export const VAT_FRANCHISE_THRESHOLD = 36_800;

function profit(subscribers: number, aiCost: number): ProfitBreakdown {
  const revenue = subscribers * PREMIUM_MONTHLY_PRICE;
  const stripeFees = subscribers * (PREMIUM_MONTHLY_PRICE * STRIPE_FEE_RATE + STRIPE_FEE_FIXED);
  const urssaf = revenue * URSSAF_RATE;
  return { revenue, stripeFees, aiCost, urssaf, net: revenue - stripeFees - aiCost - urssaf };
}

// ---------------------------------------------------------------------------
// Mois sélectionné
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** Le mois décalé de `delta` mois (« YYYY-MM »). */
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Dernier jour du mois (« YYYY-MM-DD »). */
function lastDayOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** Mois consultables (« YYYY-MM »), du plus récent au plus ancien : depuis le 1er inscrit. */
function availableMonths(users: AuthUser[], currentMonth: string): string[] {
  const first = users.reduce((min, u) => {
    const month = parisDay(u.createdAt).slice(0, 7);
    return month < min ? month : min;
  }, currentMonth);
  const months: string[] = [];
  for (let month = currentMonth; month >= first; month = shiftMonth(month, -1)) months.push(month);
  return months;
}

// ---------------------------------------------------------------------------
// Métriques
// ---------------------------------------------------------------------------

export type AdminMetrics = {
  generatedAt: string;
  /** Mois sélectionné (« YYYY-MM ») et mois consultables, du plus récent au plus ancien. */
  month: string;
  months: string[];
  isCurrentMonth: boolean;
  /**
   * Jour de l'état affiché (inscrits, abonnés) : aujourd'hui pour le mois en cours, sinon
   * le dernier jour du mois sélectionné.
   */
  asOf: string;
  /** Graphiques des 30 derniers jours : toujours calculés à partir d'aujourd'hui. */
  charts: {
    signupsPerDay: DailyPoint[];
    subscribersPerDay: DailyPoint[];
  };
  users: {
    total: number;
    newInMonth: number;
    /** Au moins une action IA dans le mois. */
    activeInMonth: number;
    free: number;
    premium: number;
  };
  revenue: {
    mrr: number;
    /** Part des inscrits abonnés au Premium (0–1). */
    conversionRate: number;
    /** Abonnés gagnés (nets) dans le mois. */
    netNewSubscribersInMonth: number;
  };
  costs: {
    byKind: { kind: AiUsageKind; count: number; unitCost: number; cost: number }[];
    total: number;
    avgPerFreeUser: number;
    avgPerPremiumUser: number;
    topUsers: { email: string; premium: boolean; actions: number; cost: number }[];
  };
  profitability: ProfitBreakdown & {
    /** Croissance mensuelle retenue pour la projection, et sa période de référence. */
    growth: { users: number; subscribers: number; basis: "30 jours" | "mois" };
    projection: (ProfitBreakdown & { month: number; subscribers: number; users: number })[];
  };
  latestSignups: { email: string; createdAt: string; premium: boolean; actionsInMonth: number }[];
};

/** `requestedMonth` (« YYYY-MM ») : mois à afficher ; par défaut (ou si invalide), le mois en cours. */
export async function getAdminMetrics(requestedMonth?: string, now = new Date()): Promise<AdminMetrics> {
  const supabase = createAdminClient();
  const today = parisDay(now);
  const currentMonth = today.slice(0, 7);

  const [users, subscriptions] = await Promise.all([
    listAllUsers(supabase),
    selectAll<SubscriptionRow>((from, to) =>
      supabase
        .from("subscriptions")
        .select("user_id, status, created_at, updated_at")
        .order("user_id")
        .range(from, to),
    ),
  ]);

  const months = availableMonths(users, currentMonth);
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : currentMonth;
  const isCurrentMonth = month === currentMonth;
  const monthStart = `${month}-01`;
  const asOf = isCurrentMonth ? today : lastDayOf(month);
  const dayBeforeMonth = lastDayOf(shiftMonth(month, -1));

  const usage = await selectAll<UsageRow>((from, to) =>
    supabase.from("usage").select("user_id, kind").eq("period", monthStart).order("id").range(from, to),
  );

  // --- Abonnés à une date ----------------------------------------------------
  // Un abonnement compte du jour de sa création jusqu'à sa fin. Pour un abonnement
  // terminé, la date de fin est sa dernière mise à jour (événement de résiliation).
  const subscribersOn = (day: string) =>
    new Set(
      subscriptions
        .filter((s) => {
          if (parisDay(s.created_at) > day) return false;
          if (isPremiumStatus(s.status)) return true;
          return ["canceled", "unpaid", "incomplete_expired"].includes(s.status) && parisDay(s.updated_at) > day;
        })
        .map((s) => s.user_id),
    );

  // --- Graphiques : 30 derniers jours, quel que soit le mois sélectionné ----
  const days = lastDays(30, now);
  const signupsByDay = new Map(days.map((d) => [d, 0]));
  for (const user of users) {
    const day = parisDay(user.createdAt);
    if (signupsByDay.has(day)) signupsByDay.set(day, signupsByDay.get(day)! + 1);
  }
  const signupsPerDay = days.map((day) => ({ day, value: signupsByDay.get(day) ?? 0 }));
  const subscribersPerDay = days.map((day) => ({ day, value: subscribersOn(day).size }));

  // --- Utilisateurs à la date de l'état affiché -------------------------------
  const usersAsOf = users.filter((u) => parisDay(u.createdAt) <= asOf);
  const premiumIds = subscribersOn(asOf);
  const premiumCount = usersAsOf.filter((u) => premiumIds.has(u.id)).length;
  const freeCount = usersAsOf.length - premiumCount;
  const newInMonth = usersAsOf.filter((u) => parisDay(u.createdAt) >= monthStart).length;
  const netNewSubscribersInMonth = premiumIds.size - subscribersOn(dayBeforeMonth).size;

  // --- Coûts IA du mois ------------------------------------------------------
  const countByKind = Object.fromEntries(AI_USAGE_KINDS.map((k) => [k, 0])) as Record<AiUsageKind, number>;
  const perUser = new Map<string, { actions: number; cost: number }>();
  for (const row of usage) {
    if (!(row.kind in AI_ACTION_COSTS)) continue;
    countByKind[row.kind] += 1;
    const entry = perUser.get(row.user_id) ?? { actions: 0, cost: 0 };
    entry.actions += 1;
    entry.cost += AI_ACTION_COSTS[row.kind];
    perUser.set(row.user_id, entry);
  }
  const byKind = AI_USAGE_KINDS.map((kind) => ({
    kind,
    count: countByKind[kind],
    unitCost: AI_ACTION_COSTS[kind],
    cost: countByKind[kind] * AI_ACTION_COSTS[kind],
  }));
  const totalCost = byKind.reduce((sum, k) => sum + k.cost, 0);

  let freeCost = 0;
  let premiumCost = 0;
  for (const [userId, { cost }] of perUser) {
    if (premiumIds.has(userId)) premiumCost += cost;
    else freeCost += cost;
  }
  const avgPerFreeUser = freeCount ? freeCost / freeCount : 0;
  const avgPerPremiumUser = premiumCount ? premiumCost / premiumCount : 0;

  const emailById = new Map(users.map((u) => [u.id, u.email ?? "(sans email)"]));
  const topUsers = [...perUser.entries()]
    .sort((a, b) => b[1].cost - a[1].cost || b[1].actions - a[1].actions)
    .slice(0, 10)
    .map(([userId, { actions, cost }]) => ({
      email: emailById.get(userId) ?? "(compte supprimé)",
      premium: premiumIds.has(userId),
      actions,
      cost,
    }));

  // --- Projection sur 12 mois ----------------------------------------------
  // Hypothèse « même croissance » : chaque mois, autant de nouveaux inscrits et d'abonnés
  // nets que sur la période de référence (30 derniers jours pour le mois en cours, encore
  // incomplet ; le mois lui-même sinon) ; coût IA moyen par utilisateur et taux inchangés.
  const growth = isCurrentMonth
    ? {
        users: signupsPerDay.reduce((sum, p) => sum + p.value, 0),
        subscribers: premiumIds.size - subscribersOn(parisDay(new Date(now.getTime() - 30 * 86_400_000))).size,
        basis: "30 jours" as const,
      }
    : { users: newInMonth, subscribers: netNewSubscribersInMonth, basis: "mois" as const };
  const projection = Array.from({ length: 12 }, (_, i) => {
    const step = i + 1;
    const subscribers = Math.max(0, premiumCount + growth.subscribers * step);
    const totalUsers = Math.max(subscribers, usersAsOf.length + growth.users * step);
    const aiCost = (totalUsers - subscribers) * avgPerFreeUser + subscribers * avgPerPremiumUser;
    return { month: step, subscribers, users: totalUsers, ...profit(subscribers, aiCost) };
  });

  // --- Derniers inscrits (à la date de l'état affiché) -----------------------
  const latestSignups = [...usersAsOf]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((u) => ({
      email: u.email ?? "(sans email)",
      createdAt: u.createdAt,
      premium: premiumIds.has(u.id),
      actionsInMonth: perUser.get(u.id)?.actions ?? 0,
    }));

  return {
    generatedAt: now.toISOString(),
    month,
    months,
    isCurrentMonth,
    asOf,
    charts: { signupsPerDay, subscribersPerDay },
    users: {
      total: usersAsOf.length,
      newInMonth,
      activeInMonth: perUser.size,
      free: freeCount,
      premium: premiumCount,
    },
    revenue: {
      mrr: premiumCount * PREMIUM_MONTHLY_PRICE,
      conversionRate: usersAsOf.length ? premiumCount / usersAsOf.length : 0,
      netNewSubscribersInMonth,
    },
    costs: { byKind, total: totalCost, avgPerFreeUser, avgPerPremiumUser, topUsers },
    profitability: { ...profit(premiumCount, totalCost), growth, projection },
    latestSignups,
  };
}


// ---------------------------------------------------------------------------
// Avis utilisateurs (table "feedback", migration 0016) : tous les avis, sans filtre de mois
// ---------------------------------------------------------------------------

export type FeedbackEntry = Feedback & { email: string; updatedAt: string };

export type FeedbackMetrics = {
  count: number;
  averageRating: number;
  /** Nombre d'avis par note, de 1 à 5 étoiles. */
  ratingCounts: number[];
  favorites: { key: FavoriteFeature; count: number }[];
  missing: { key: MissingFeature; count: number }[];
  recommend: { key: RecommendAnswer; count: number }[];
  /** Tendance : avis donnés ou modifiés par mois (6 derniers mois, du plus ancien au plus récent). */
  trend: { month: string; count: number; averageRating: number | null; recommendYes: number }[];
  entries: FeedbackEntry[];
};

/** Avis utilisateurs ; null si la table n'existe pas encore (migration 0016 non appliquée). */
export async function getFeedbackMetrics(now = new Date()): Promise<FeedbackMetrics | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("user_id, rating, favorite_feature, missing, improvement, recommend, updated_at")
    .order("updated_at", { ascending: false })
    .limit(PAGE);
  if (error) {
    console.error("[admin] avis", error.message);
    return null;
  }

  const users = await listAllUsers(supabase);
  const emailById = new Map(users.map((u) => [u.id, u.email ?? "(sans email)"]));
  const entries: FeedbackEntry[] = data.map((row) => ({
    ...toFeedback(row),
    email: emailById.get(row.user_id) ?? "(compte supprimé)",
    updatedAt: row.updated_at,
  }));

  const count = entries.length;
  const tally = <K extends string>(keys: K[], pick: (entry: FeedbackEntry) => K[]) =>
    keys
      .map((key) => ({ key, count: entries.filter((e) => pick(e).includes(key)).length }))
      .sort((a, b) => b.count - a.count);

  const currentMonth = parisDay(now).slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, i - 5));
  const trend = months.map((month) => {
    const inMonth = entries.filter((e) => parisDay(e.updatedAt).startsWith(month));
    return {
      month,
      count: inMonth.length,
      averageRating: inMonth.length ? inMonth.reduce((s, e) => s + e.rating, 0) / inMonth.length : null,
      recommendYes: inMonth.filter((e) => e.recommend === "oui").length,
    };
  });

  return {
    count,
    averageRating: count ? entries.reduce((s, e) => s + e.rating, 0) / count : 0,
    ratingCounts: [1, 2, 3, 4, 5].map((r) => entries.filter((e) => e.rating === r).length),
    favorites: tally(Object.keys(FAVORITE_FEATURES) as FavoriteFeature[], (e) => [e.favoriteFeature]),
    missing: tally(Object.keys(MISSING_FEATURES) as MissingFeature[], (e) => e.missing),
    recommend: (Object.keys(RECOMMEND_ANSWERS) as RecommendAnswer[]).map((key) => ({
      key,
      count: entries.filter((e) => e.recommend === key).length,
    })),
    trend,
    entries,
  };
}
