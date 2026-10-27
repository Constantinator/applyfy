import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Sector } from "./cv-sector-context";

// Mots-clés relevés dans les offres d'emploi (table job_keywords, migration 0032), passés en
// bonus au coach du CV Builder. Lecture publique : client anonyme, sans session.

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
/** Secteur encore vide (table pas encore alimentée) : nouvel essai plus tôt. */
const EMPTY_CACHE_TTL = 60 * 60 * 1000;
const TOP_KEYWORDS = 30;

const cache = new Map<Sector, { keywords: string[]; expires: number }>();

/** Les 30 mots-clés les plus fréquents du secteur ; liste vide s'il n'y en a pas ou en cas d'erreur. */
export async function getKeywordsForSector(sector: Sector): Promise<string[]> {
  const cached = cache.get(sector);
  if (cached && cached.expires > Date.now()) return cached.keywords;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from("job_keywords")
      .select("keyword")
      .eq("sector", sector)
      .order("frequency", { ascending: false })
      .limit(TOP_KEYWORDS);
    if (error) throw error;
    const keywords = (data ?? []).map((row) => String(row.keyword));
    cache.set(sector, { keywords, expires: Date.now() + (keywords.length ? CACHE_TTL : EMPTY_CACHE_TTL) });
    return keywords;
  } catch (error) {
    console.error("[job-keywords] lecture impossible", sector, error);
    return [];
  }
}
