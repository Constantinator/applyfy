import Link from "next/link";

import { ApplicationsView } from "@/components/dashboard/applications-view";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { getApplications } from "@/lib/applications";
import { FOLLOW_UP_AFTER_DAYS, FOLLOW_UP_FILTER, needsFollowUp } from "@/lib/follow-up";
import { DEFAULT_SORT, isSortKey } from "@/lib/sort-applications";
import { isApplicationStatus } from "@/lib/types";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { filtre, tri, ajout, suppression } = await searchParams;
  const initialFilter =
    filtre === FOLLOW_UP_FILTER || isApplicationStatus(filtre) ? filtre : "toutes";
  const initialSort = isSortKey(tri) ? tri : DEFAULT_SORT;

  const { applications, source } = await getApplications();
  // Date de référence unique, transmise au client pour des calculs identiques des deux côtés.
  const now = new Date();
  const toFollowUp = applications.filter((app) => needsFollowUp(app, now));

  const countByStatus = (status: string) =>
    applications.filter((app) => app.status === status).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      {source === "demo" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
          données.
        </p>
      )}

      {ajout === "ok" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
        >
          ✓ Candidature ajoutée.
        </p>
      )}
      {suppression === "ok" && (
        <p
          role="status"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
        >
          Candidature supprimée.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mes candidatures</h1>
          <p className="mt-1 text-sm text-slate-500">
            Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
          </p>
        </div>
        <Link
          href="/candidatures/nouvelle"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold whitespace-nowrap text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          + Nouvelle candidature
        </Link>
      </div>

      <StatsCards
        stats={[
          { label: "Candidatures", value: applications.length },
          {
            label: "En attente de réponse",
            value: countByStatus("envoyee") + countByStatus("relancee"),
          },
          { label: "Entretiens", value: countByStatus("entretien") },
          {
            label: "À relancer",
            value: toFollowUp.length,
            hint: `Sans nouvelles depuis ${FOLLOW_UP_AFTER_DAYS} j+`,
            highlight: toFollowUp.length > 0,
          },
        ]}
      />

      <ApplicationsView
        applications={applications}
        nowIso={now.toISOString()}
        initialFilter={initialFilter}
        initialSort={initialSort}
      />
    </main>
  );
}
