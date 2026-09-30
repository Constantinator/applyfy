import { ApplicationsList } from "@/components/dashboard/applications-list";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { StatusFilter, type FilterOption } from "@/components/dashboard/status-filter";
import { FOLLOW_UP_AFTER_DAYS, getApplications, needsFollowUp } from "@/lib/applications";
import { APPLICATION_STATUSES, STATUS_LABELS, isApplicationStatus } from "@/lib/types";

const FOLLOW_UP_FILTER = "a_relancer";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { filtre } = await searchParams;
  const active =
    filtre === FOLLOW_UP_FILTER || isApplicationStatus(filtre) ? filtre : "toutes";

  const { applications, source } = await getApplications();
  const toFollowUp = applications.filter((app) => needsFollowUp(app));

  const visible =
    active === "toutes"
      ? applications
      : active === FOLLOW_UP_FILTER
        ? toFollowUp
        : applications.filter((app) => app.status === active);

  const countByStatus = (status: string) =>
    applications.filter((app) => app.status === status).length;

  const filterOptions: FilterOption[] = [
    { value: "toutes", label: "Toutes", count: applications.length },
    { value: FOLLOW_UP_FILTER, label: "À relancer", count: toFollowUp.length },
    ...APPLICATION_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABELS[status],
      count: countByStatus(status),
    })),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      {source === "demo" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
          données.
        </p>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mes candidatures</h1>
        <p className="mt-1 text-sm text-slate-500">
          Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
        </p>
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

      <StatusFilter options={filterOptions} active={active} />

      <ApplicationsList applications={visible} />
    </main>
  );
}
