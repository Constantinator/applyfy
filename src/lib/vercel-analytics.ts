import "server-only";

// Trafic du site (section « Trafic » de /admin) : API publique Vercel Web Analytics
// (https://vercel.com/docs/analytics/web-analytics-api), données de production.
//   VERCEL_API_TOKEN        jeton d'accès Vercel (Account Settings > Tokens), lecture seule
//   VERCEL_ANALYTICS_PROJECT_ID / VERCEL_ANALYTICS_TEAM_ID   facultatifs : projet Applyfy
//                           par défaut (identifiants non secrets, cf. .vercel/project.json)

const API = "https://api.vercel.com/v1/query/web-analytics/visits";
const PROJECT_ID = process.env.VERCEL_ANALYTICS_PROJECT_ID || "prj_Kz5ozsD1oIv5lu4v3zyzQev7Vusa";
const TEAM_ID = process.env.VERCEL_ANALYTICS_TEAM_ID || "team_6k2Rx9prkQvDbZNv2hqjW59O";
/** Données mises en cache 10 minutes (le tableau de bord est rechargé souvent). */
const REVALIDATE_SECONDS = 600;

export function isTrafficConfigured() {
  return Boolean(process.env.VERCEL_API_TOKEN);
}

export type TrafficMetrics = {
  /** Visiteurs uniques et pages vues sur la période (mois choisi). */
  visitors: number;
  pageviews: number;
  /** Pages les plus vues (modèle de page, ex. /candidatures/[id]), 5 au plus. */
  topPages: { route: string; pageviews: number; visitors: number }[];
  /** Visiteurs par jour, 30 derniers jours (jours UTC). */
  dailyVisitors: { day: string; value: number }[];
};

type Row = Record<string, unknown> & { pageviews?: number; visitors?: number };

async function query<T>(endpoint: "count" | "aggregate", params: Record<string, string>): Promise<T> {
  const search = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, ...params });
  const response = await fetch(`${API}/${endpoint}?${search}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Jeton Vercel refusé : vérifie VERCEL_API_TOKEN (accès à l'équipe du projet)."
        : `Vercel Web Analytics a répondu ${response.status}${detail ? ` : ${detail.slice(0, 200)}` : ""}`,
    );
  }
  return ((await response.json()) as { data: T }).data;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * @param since premier jour de la période (YYYY-MM-DD), ex. le 1er du mois choisi
 * @param until dernier jour inclus (YYYY-MM-DD)
 */
export async function getTrafficMetrics(since: string, until: string, now = new Date()): Promise<TrafficMetrics> {
  const thirtyDaysAgo = isoDay(new Date(now.getTime() - 29 * 86_400_000));
  const [total, routes, daily] = await Promise.all([
    query<Row>("count", { since, until }),
    // « Others » regroupe les pages hors du classement : 6 lignes pour garder un top 5.
    query<Row[]>("aggregate", { since, until, by: "route", limit: "6" }),
    query<Row[]>("aggregate", { since: thirtyDaysAgo, until: isoDay(now), by: "day" }),
  ]);

  return {
    visitors: total.visitors ?? 0,
    pageviews: total.pageviews ?? 0,
    topPages: routes
      .filter((row) => typeof row.route === "string" && row.route !== "Others")
      .map((row) => ({ route: row.route as string, pageviews: row.pageviews ?? 0, visitors: row.visitors ?? 0 }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 5),
    dailyVisitors: daily.map((row) => ({
      day: String(row.timestamp).slice(0, 10),
      value: row.visitors ?? 0,
    })),
  };
}
