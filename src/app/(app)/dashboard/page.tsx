import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import { CvCard, type LatestCv } from "@/components/dashboard/cv-card";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { GoogleAdsConversion } from "@/components/dashboard/google-ads-conversion";
import { IconSparkles } from "@/components/icons";
import { OfferLinkForm } from "@/components/dashboard/offer-link-form";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TodoCard } from "@/components/dashboard/todo-card";
import { getAccountCreatedAt, getAccountName } from "@/lib/account";
import { getApplications } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { getBetaSpotsLeft, getMyBeta, hasBetaPremium } from "@/lib/beta";
import { pendingBetaReport } from "@/lib/beta-rules";
import { getLatestBuilderCv } from "@/lib/cv-builder";
import { scoreCv, weakestCategory } from "@/lib/cv-score";
import { loadScoringContext } from "@/lib/cv-score-context";
import { buildStartSteps, isNewAccount } from "@/lib/dashboard-start";
import { buildTodo, todayLabel, todoCountLabel } from "@/lib/dashboard-todo";
import { FOLLOW_UP_AFTER_DAYS, needsFollowUp } from "@/lib/follow-up";
import { isStripeConfigured, syncCheckoutSession } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

export const metadata: Metadata = { title: "Tableau de bord — Applyfy" };

/** Paramètres de l'ancienne liste, qui était sur /dashboard : favoris et e-mails déjà envoyés. */
const LIST_PARAMS = ["filtre", "tri", "ajout", "suppression"];

/** Dernier CV et son score, le même que dans l'éditeur ; undefined si la lecture échoue. */
async function loadLatestCv(): Promise<LatestCv | null | undefined> {
  try {
    const cv = await getLatestBuilderCv();
    if (!cv) return null;
    const score = scoreCv(cv.data, await loadScoringContext(cv.data));
    return { id: cv.id, title: cv.title, score: score.score, weakPoint: weakestCategory(score)?.label ?? null };
  } catch (error) {
    console.error("[dashboard] lecture du dernier CV", error);
    return undefined;
  }
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const { premium: premiumWelcome, session_id, beta: betaParam } = params;
  const welcomePremium = premiumWelcome === "bienvenue";

  // Jamais au retour de Stripe : la conversion Google Ads est envoyée depuis cette page.
  if (!welcomePremium && LIST_PARAMS.some((name) => params[name] !== undefined)) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      for (const item of [value ?? []].flat()) query.append(name, item);
    }
    redirect(`/candidatures?${query}`);
  }

  // Retour de Stripe Checkout : abonnement enregistré tout de suite, sans attendre le webhook.
  if (welcomePremium && typeof session_id === "string" && isStripeConfigured()) {
    const user = await getCurrentUser();
    if (user) {
      await syncCheckoutSession(session_id, user.id).catch((error) => {
        console.error("[dashboard] retour de Stripe Checkout", error);
      });
    }
  }

  const [{ applications, source }, subscription, beta, accountName, accountCreatedAt, latestCv] = await Promise.all([
    getApplications(),
    getSubscription(),
    getMyBeta(),
    // Non bloquant : sans nom, « Bonjour » seul.
    getAccountName().catch(() => null),
    // Non bloquant : sans date, pas de bloc « Pour bien démarrer ».
    getAccountCreatedAt().catch(() => null),
    loadLatestCv(),
  ]);
  const premium = (subscription?.premium ?? false) || hasBetaPremium(beta);
  // Programme beta : proposé à ceux qui n'y participent pas encore.
  const canJoinBeta = source !== "demo" && !beta;
  const betaSpotsLeft = canJoinBeta ? await getBetaSpotsLeft() : 0;
  const canGoPremium = source !== "demo" && !premium;
  const now = new Date();
  const toFollowUp = applications.filter((app) => needsFollowUp(app, now));
  const todo = buildTodo(applications, now);
  const hasRealApplication = applications.some((app) => !app.is_example);
  const betaReport = pendingBetaReport(beta, now);
  // Lecture du CV en échec : étapes inconnues, pas de bloc.
  const startSteps =
    latestCv !== undefined && isNewAccount(accountCreatedAt, now) ? buildStartSteps(latestCv, applications) : null;

  const countByStatus = (status: string) =>
    applications.filter((app) => app.status === status).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {source === "demo" && (
        <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-400">
          Mode démo : configure Supabase dans <code>.env.local</code> pour utiliser tes vraies
          données.
        </p>
      )}

      {/* Conversion Google Ads (abonnement Premium) au retour de Stripe Checkout. */}
      {welcomePremium && (
        <Suspense fallback={null}>
          <GoogleAdsConversion />
        </Suspense>
      )}

      {welcomePremium && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-400/30"
        >
          🎉 Bienvenue en Premium ! Toutes les fonctionnalités IA sont maintenant illimitées.
        </p>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{todayLabel(now)}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight break-words text-slate-900 sm:text-4xl dark:text-white">
            Bonjour{accountName ? ` ${accountName.firstName}` : ""}
          </h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
            {!hasRealApplication ? (
              "Commence par ajouter ta première candidature."
            ) : todo.length > 0 ? (
              <>
                Tu as{" "}
                <strong className="font-semibold text-slate-900 dark:text-white">{todoCountLabel(todo.length)}</strong>{" "}
                pour faire avancer tes candidatures.
              </>
            ) : (
              "Bravo, tout est à jour aujourd'hui."
            )}
          </p>
        </div>
        {(canJoinBeta || canGoPremium) && (
          <div className="flex flex-wrap items-center gap-2 self-start">
            {canJoinBeta && (
              <BetaJoinDialog
                mode="join"
                spotsLeft={betaSpotsLeft}
                autoOpen={betaParam === "rejoindre"}
                triggerClassName="btn-secondary min-h-11 px-4 text-sm"
              />
            )}
            {canGoPremium && (
              <Link href="/premium" className="btn-secondary min-h-11 px-4 text-sm">
                <IconSparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Passer au Premium
              </Link>
            )}
          </div>
        )}
      </div>

      <OfferLinkForm />

      {betaReport && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-900 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-100 dark:ring-blue-400/30">
          <span>Rapport à rendre avant le {betaReport.dueLabel}</span>
          <Link
            href="/beta"
            className="inline-flex min-h-11 items-center font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300"
          >
            Écrire le rapport
          </Link>
        </p>
      )}

      {startSteps && <GettingStarted steps={startSteps} />}

      <div className={`grid items-start gap-6 ${latestCv === undefined ? "" : "lg:grid-cols-[minmax(0,1fr)_22rem]"}`}>
        <TodoCard items={todo} hasRealApplication={hasRealApplication} />
        {/* Lecture du CV en échec : pas de carte, plutôt qu'un « Crée ton CV » trompeur. */}
        {latestCv !== undefined && <CvCard cv={latestCv} />}
      </div>

      {applications.length > 0 && (
        <section aria-labelledby="stats-title" className="space-y-3">
          <h2 id="stats-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Tes chiffres
          </h2>
          <StatsCards
            stats={[
              { label: "Candidatures", value: applications.length, tone: "blue" },
              {
                label: "En attente de réponse",
                value:
                  countByStatus("envoyee") + countByStatus("en_attente") + countByStatus("relancee"),
                tone: "indigo",
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
        </section>
      )}
    </main>
  );
}
