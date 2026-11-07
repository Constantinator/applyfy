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
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        <div>
          <Link href="/admin" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
            Retour à l&apos;admin
          </Link>
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] mt-2 text-ink">Roadmap</h1>
          <p className="mt-1.5 text-sm text-muted">
            Prochaines fonctionnalités d&apos;Applyfy. Clique sur un statut pour le faire avancer.
          </p>
        </div>

        {!items ? (
          <p className="ui-notice px-4 py-3 text-sm">
            La roadmap n&apos;est pas encore disponible : applique la migration 0021 (table
            roadmap_items) dans Supabase.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="text-sm text-muted">
                {ROADMAP_STATUSES.map(
                  (status) => items.filter((i) => i.status === status).length,
                ).join(" · ")}{" "}
                <span className="text-muted">(à faire · en cours · terminé)</span>
              </p>
              <AddRoadmapItemForm />
            </div>

            {ROADMAP_CATEGORIES.map((category) => {
              const inCategory = items
                .filter((item) => item.category === category)
                .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
              return (
                <section key={category} aria-labelledby={`roadmap-${category}`} className="space-y-3">
                  <h2 id={`roadmap-${category}`} className="ui-title-sm">
                    {ROADMAP_CATEGORY_LABELS[category]}{" "}
                    <span className="text-sm font-normal text-muted">({inCategory.length})</span>
                  </h2>
                  {inCategory.length === 0 ? (
                    <p className="text-sm text-muted">Aucun élément.</p>
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
    </div>
  );
}
