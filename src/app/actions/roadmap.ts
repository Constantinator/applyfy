"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireAdmin } from "@/lib/admin-metrics";
import { createRoadmapItem, deleteRoadmapItem, updateRoadmapStatus } from "@/lib/roadmap";
import {
  isRoadmapCategory,
  isRoadmapStatus,
  ROADMAP_DESCRIPTION_MAX_LENGTH,
  ROADMAP_TITLE_MAX_LENGTH,
} from "@/lib/roadmap-options";

export type RoadmapResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(label: string, task: () => Promise<void>): Promise<RoadmapResult> {
  try {
    await task();
    revalidatePath("/admin/roadmap");
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[roadmap] ${label}`, error);
    return { ok: false, error: "L'opération a échoué. Réessaie dans un instant." };
  }
}

export async function addRoadmapItemAction(input: {
  title: string;
  description: string;
  status: string;
  category: string;
}): Promise<RoadmapResult> {
  await requireAdmin();
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!title || title.length > ROADMAP_TITLE_MAX_LENGTH) {
    return { ok: false, error: `Titre requis (${ROADMAP_TITLE_MAX_LENGTH} caractères max).` };
  }
  if (description.length > ROADMAP_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "Description trop longue (2 000 caractères max)." };
  }
  const { status, category } = input;
  if (!isRoadmapStatus(status)) return { ok: false, error: "Statut invalide." };
  if (!isRoadmapCategory(category)) return { ok: false, error: "Catégorie invalide." };
  return run("ajout", () =>
    createRoadmapItem({ title, description: description || null, status, category }),
  );
}

export async function setRoadmapStatusAction(id: string, status: string): Promise<RoadmapResult> {
  await requireAdmin();
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Élément invalide." };
  if (!isRoadmapStatus(status)) return { ok: false, error: "Statut invalide." };
  return run("statut", () => updateRoadmapStatus(id, status));
}

export async function deleteRoadmapItemAction(id: string): Promise<RoadmapResult> {
  await requireAdmin();
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Élément invalide." };
  return run("suppression", () => deleteRoadmapItem(id));
}
