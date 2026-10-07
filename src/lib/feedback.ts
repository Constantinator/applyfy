import "server-only";

import { requireUser } from "./auth";
import type { Feedback, FavoriteFeature, MissingFeature, RecommendAnswer } from "./feedback-options";
import { createClient } from "./supabase/server";

// Avis de l'utilisateur connecté (table "feedback", migration 0016) : un seul par
// utilisateur, modifiable. Lecture et écriture avec sa session (RLS).

export type FeedbackRow = {
  rating: number;
  favorite_feature: FavoriteFeature;
  missing: MissingFeature[];
  improvement: string | null;
  recommend: RecommendAnswer;
  updated_at: string;
};

export const toFeedback = (row: FeedbackRow): Feedback => ({
  rating: row.rating,
  favoriteFeature: row.favorite_feature,
  missing: row.missing ?? [],
  improvement: row.improvement,
  recommend: row.recommend,
});

/** Avis déjà donné par l'utilisateur connecté, ou null. */
export async function getMyFeedback(): Promise<Feedback | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("rating, favorite_feature, missing, improvement, recommend, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Lecture de l'avis impossible : ${error.message}`);
  return data ? toFeedback(data as FeedbackRow) : null;
}

/** Crée ou remplace l'avis de l'utilisateur connecté. */
export async function saveMyFeedback(feedback: Feedback) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").upsert(
    {
      user_id: user.id,
      rating: feedback.rating,
      favorite_feature: feedback.favoriteFeature,
      missing: feedback.missing,
      improvement: feedback.improvement,
      recommend: feedback.recommend,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Enregistrement de l'avis impossible : ${error.message}`);
}
