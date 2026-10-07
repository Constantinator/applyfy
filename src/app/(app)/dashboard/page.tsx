import Link from "next/link";

import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import { ApplicationsView } from "@/components/dashboard/applications-view";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { IconPlus, IconSparkles } from "@/components/icons";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { getApplications } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { getBetaSpotsLeft, getMyBeta, hasBetaPremium } from "@/lib/beta";
import { FOLLOW_UP_AFTER_DAYS, FOLLOW_UP_FILTER, needsFollowUp } from "@/lib/follow-up";
import { DEFAULT_SORT, isSortKey } from "@/lib/sort-applications";
import { isStripeConfigured, syncCheckoutSession } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";
import { isApplicationStatus } from "@/lib/types";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { filtre, tri, ajout, suppression, premium: premiumWelcome, session_id, beta: betaParam } = await searchParams;
  const welcomePremium = premiumWelcome === "bienvenue";
  // Retour de Stripe Checkout : abonnement enregistré tout de suite, sans attendre le webhook.
  if (welcomePremium && typeof session_id === "string" && isStripeConfigured()) {
    const user = await getCurrentUser();
    if (user) {
      await syncCheckoutSession(session_id, user.id).catch((error) => {
        console.error("[dashboard] retour de Stripe Checkout", error);
      });
    }
  }
  const initialFilter =
    filtre === FOLLOW_UP_FILTER || isApplicationStatus(filtre) ? filtre : "toutes";
  const initialSort = isSortKey(tri) ? tri : DEFAULT_SORT;

  const [{ applications, source }, subscription, beta] = await Promise.all([
    getApplications(),
    getSubscription(),
    getMyBeta(),
  ]);
  const premium = (subscription?.premium ?? false) || hasBetaPremium(beta);
  // Programme beta : proposé à ceux qui n'y participent pas encore.
  const canJoinBeta = source !== "demo" && !beta;
  const betaSpotsLeft = canJoinBeta ? await getBetaSpotsLeft() : 0;
  // Date de référence unique, transmise au client pour des calculs identiques des deux côtés.
  const now = new Date();
  const toFollowUp = applications.filter((app) => needsFollowUp(app, now));

  const countByStatus = (status: string) =>
    applications.filter((app) => app.status === status).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {source === "demo" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
          données.
        </p>
      )}

      {welcomePremium && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
        >
          🎉 Bienvenue en Premium ! Toutes les fonctionnalités IA sont maintenant illimitées.
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes candidatures</h1>
          <p className="mt-1.5 text-slate-500">
            Suis l&apos;avancement de ta recherche d&apos;emploi et relance au bon moment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {canJoinBeta && (
            <BetaJoinDialog mode="join" spotsLeft={betaSpotsLeft} autoOpen={betaParam === "rejoindre"} />
          )}
          {source !== "demo" && !premium && (
            <Link href="/premium" className="btn-secondary px-4 py-2.5 text-sm">
              <IconSparkles className="h-4 w-4 text-blue-600" />
              Passer au Premium
            </Link>
          )}
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
          <StatsCards
            stats={[
              { label: "Candidatures", value: applications.length, tone: "blue" },
              {
                label: "En attente de réponse",
                value:
                  countByStatus("envoyee") + countByStatus("en_attente") + countByStatus("relancee"),
                tone: "cyan",
              },
              { label: "Entretiens", value: countByStatus("entretien"), tone: "violet" },
              {
                label: "À relancer",
                value: toFollowUp.length,
                hint: `Sans nouvelles depuis ${FOLLOW_UP_AFTER_DAYS} j+`,
                tone: "amber",
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
        </>
      )}
    </main>
  );
}
