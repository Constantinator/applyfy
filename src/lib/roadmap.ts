import "server-only";

import type { RoadmapCategory, RoadmapItem, RoadmapStatus } from "./roadmap-options";
import { createAdminClient } from "./supabase/admin";

// Roadmap produit (table roadmap_items, migration 0021). Client service_role, à n'appeler
// qu'après requireAdmin().

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  category: RoadmapCategory;
  created_at: string;
};

/** Tous les éléments, les plus anciens d'abord ; null si la table n'existe pas encore. */
export async function listRoadmapItems(): Promise<RoadmapItem[] | null> {
  const { data, error } = await createAdminClient()
    .from("roadmap_items")
    .select("id, title, description, status, category, created_at")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[roadmap] lecture", error.message);
    return null;
  }
  return (data as Row[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    category: row.category,
    createdAt: row.created_at,
  }));
}

export async function createRoadmapItem(item: {
  title: string;
  description: string | null;
  status: RoadmapStatus;
  category: RoadmapCategory;
}) {
  const { error } = await createAdminClient().from("roadmap_items").insert(item);
  if (error) throw new Error(`Ajout impossible : ${error.message}`);
}

export async function updateRoadmapStatus(id: string, status: RoadmapStatus) {
  const { error } = await createAdminClient().from("roadmap_items").update({ status }).eq("id", id);
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
}

export async function deleteRoadmapItem(id: string) {
  const { error } = await createAdminClient().from("roadmap_items").delete().eq("id", id);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);
}
