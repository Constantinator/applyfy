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
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        {source === "demo" && (
          <p className="ui-notice px-4 py-2 text-sm">
            Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
            données.
          </p>
        )}

        {ajout === "ok" && (
          <p
            role="status"
            className="ui-notice px-4 py-2 text-sm"
          >
            ✓ Candidature ajoutée.
          </p>
        )}
        {suppression === "ok" && (
          <p
            role="status"
            className="ui-notice px-4 py-2 text-sm"
          >
            Candidature supprimée.
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">Candidatures</h1>
            <p className="mt-1.5 text-muted dark:text-slate-400">
              Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <OnboardingTip id="nouvelle-candidature" text="Clique ici pour ajouter une offre" align="end">
              <Link href="/candidatures/nouvelle" className="ui-btn-primary">
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
              <div className="ui-notice flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  Ceci est un exemple — ajoute ta première vraie candidature !
                </p>
                <Link href="/candidatures/nouvelle" className="ui-btn-primary shrink-0 self-start sm:self-auto">
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
    </div>
  );
}
