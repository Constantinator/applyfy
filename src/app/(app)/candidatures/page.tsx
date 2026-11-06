import type { Metadata } from "next";
import Link from "next/link";

import { ApplicationsView } from "@/components/dashboard/applications-view";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { IconPlus } from "@/components/icons";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { getApplications } from "@/lib/applications";
import { FOLLOW_UP_FILTER } from "@/lib/follow-up";
import { DEFAULT_SORT, isSortKey } from "@/lib/sort-applications";
import { isApplicationStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Candidatures — Applyfy" };

/** Liste des candidatures : recherche, filtres (?filtre=…), tri (?tri=…), sélecteur de statut. */
export default async function ApplicationsPage({ searchParams }: PageProps<"/candidatures">) {
  const { filtre, tri, ajout, suppression } = await searchParams;
  const initialFilter =
    filtre === FOLLOW_UP_FILTER || isApplicationStatus(filtre) ? filtre : "toutes";
  const initialSort = isSortKey(tri) ? tri : DEFAULT_SORT;

  const { applications, source } = await getApplications();
  // Date de référence unique, transmise au client pour des calculs identiques des deux côtés.
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {source === "demo" && (
        <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-400">
          Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
          données.
        </p>
      )}

      {ajout === "ok" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-400/30"
        >
          ✓ Candidature ajoutée.
        </p>
      )}
      {suppression === "ok" && (
        <p
          role="status"
          className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700"
        >
          Candidature supprimée.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Candidatures</h1>
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">
            Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <OnboardingTip id="nouvelle-candidature" text="Clique ici pour ajouter une offre" align="end">
            <Link href="/candidatures/nouvelle" className="btn-primary px-4 py-2.5 text-sm">
              <IconPlus className="h-4 w-4" />
              Nouvelle candidature
            </Link>
          </OnboardingTip>
        </div>
      </div>

      {applications.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          {/* Seulement la candidature exemple créée à l'inscription : invitation à ajouter la vraie. */}
          {applications.every((app) => app.is_example) && (
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/60 dark:ring-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ceci est un exemple — ajoute ta première vraie candidature !
              </p>
              <Link href="/candidatures/nouvelle" className="btn-primary shrink-0 self-start px-4 py-2 text-sm sm:self-auto">
                <IconPlus className="h-4 w-4" />
                Ajouter une candidature
              </Link>
            </div>
          )}

          <ApplicationsView
            applications={applications}
            nowIso={now.toISOString()}
            initialFilter={initialFilter}
            initialSort={initialSort}
          />
        </>
      )}
    </main>
  );
}
