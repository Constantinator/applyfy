import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AddRoadmapItemForm, RoadmapItemCard } from "@/components/admin/roadmap-controls";
import { requireAdmin } from "@/lib/admin-metrics";
import { listRoadmapItems } from "@/lib/roadmap";
import {
  ROADMAP_CATEGORIES,
  ROADMAP_CATEGORY_LABELS,
  ROADMAP_STATUSES,
  type RoadmapStatus,
} from "@/lib/roadmap-options";

export const metadata: Metadata = { title: "Roadmap — Admin Applyfy", robots: { index: false } };

// Dans chaque catégorie : en cours, puis à faire, puis terminé (les plus anciens d'abord).
const STATUS_ORDER: Record<RoadmapStatus, number> = { en_cours: 0, a_faire: 1, termine: 2 };

export default async function RoadmapAdminPage() {
  await connection();
  await requireAdmin();
  const items = await listRoadmapItems();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          Retour à l&apos;admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Roadmap</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Prochaines fonctionnalités d&apos;Applyfy. Clique sur un statut pour le faire avancer.
        </p>
      </div>

      {!items ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-400">
          La roadmap n&apos;est pas encore disponible : applique la migration 0021 (table
          roadmap_items) dans Supabase.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-sm text-slate-600">
              {ROADMAP_STATUSES.map(
                (status) => items.filter((i) => i.status === status).length,
              ).join(" · ")}{" "}
              <span className="text-slate-400">(à faire · en cours · terminé)</span>
            </p>
            <AddRoadmapItemForm />
          </div>

          {ROADMAP_CATEGORIES.map((category) => {
            const inCategory = items
              .filter((item) => item.category === category)
              .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
            return (
              <section key={category} aria-labelledby={`roadmap-${category}`} className="space-y-3">
                <h2 id={`roadmap-${category}`} className="text-lg font-semibold text-slate-900">
                  {ROADMAP_CATEGORY_LABELS[category]}{" "}
                  <span className="text-sm font-normal text-slate-400">({inCategory.length})</span>
                </h2>
                {inCategory.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun élément.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inCategory.map((item) => (
                      // key avec le statut : l'affichage repart de la valeur du serveur après un changement.
                      <RoadmapItemCard key={`${item.id}-${item.status}`} item={item} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
