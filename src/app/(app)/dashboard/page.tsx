import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import { CvCard, type LatestCv } from "@/components/dashboard/cv-card";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { GoogleAdsConversion } from "@/components/dashboard/google-ads-conversion";
import { IconSparkles } from "@/components/icons";
import { MyWeekCard } from "@/components/dashboard/my-week-card";
import { OfferLinkForm } from "@/components/dashboard/offer-link-form";
import { OffersForYou } from "@/components/dashboard/offers-for-you";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TodoCard } from "@/components/dashboard/todo-card";
import { getAccountCreatedAt, getAccountName } from "@/lib/account";
import { getApplications, getResponseEvents } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { getBetaSpotsLeft, getMyBeta, hasBetaPremium } from "@/lib/beta";
import { pendingBetaReport } from "@/lib/beta-rules";
import { getLatestBuilderCv } from "@/lib/cv-builder";
import { targetJobOf } from "@/lib/cv-builder-types";
import { scoreCv, weakestCategory } from "@/lib/cv-score";
import { loadScoringContext } from "@/lib/cv-score-context";
import { buildStartSteps, isNewAccount } from "@/lib/dashboard-start";
import { buildTodo, todayLabel, todoCountLabel } from "@/lib/dashboard-todo";
import { buildPeriodStats } from "@/lib/dashboard-week";
import { FOLLOW_UP_AFTER_DAYS, needsFollowUp } from "@/lib/follow-up";
import { getWeeklyGoal } from "@/lib/profile";
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
    const context = await loadScoringContext(cv.data);
    const score = scoreCv(cv.data, context);
    return {
      id: cv.id,
      title: cv.title,
      score: score.score,
      weakPoint: weakestCategory(score)?.label ?? null,
      sector: context.sector,
      targetJob: targetJobOf(cv.data) || cv.data.personal.jobTitle,
    };
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

  const [
    { applications, source },
    subscription,
    beta,
    accountName,
    accountCreatedAt,
    latestCv,
    responseEvents,
    weeklyGoal,
  ] = await Promise.all([
    getApplications(),
    getSubscription(),
    getMyBeta(),
    // Non bloquant : sans nom, « Bonjour » seul.
    getAccountName().catch(() => null),
    // Non bloquant : sans date, pas de bloc « Pour bien démarrer ».
    getAccountCreatedAt().catch(() => null),
    loadLatestCv(),
    getResponseEvents().catch((error) => {
      console.error("[dashboard] lecture des réponses", error);
      return null;
    }),
    getWeeklyGoal(),
  ]);
  const premium = (subscription?.premium ?? false) || hasBetaPremium(beta);
  // Programme beta : proposé à ceux qui n'y participent pas encore.
  const canJoinBeta = source !== "demo" && !beta;
  const betaSpotsLeft = canJoinBeta ? await getBetaSpotsLeft() : 0;
  const canGoPremium = source !== "demo" && !premium;
  const now = new Date();
  // « Tes chiffres » : jamais la candidature exemple.
  const realApplications = applications.filter((app) => !app.is_example);
  const toFollowUp = realApplications.filter((app) => needsFollowUp(app, now));
  const todo = buildTodo(applications, now);
  const hasRealApplication = realApplications.length > 0;
  // Lecture des réponses en échec : pas de carte, plutôt que des chiffres faux.
  const periodStats = responseEvents && buildPeriodStats(applications, responseEvents, now);
  const betaReport = pendingBetaReport(beta, now);
  // Lecture du CV en échec : étapes inconnues, pas de bloc.
  const startSteps =
    latestCv !== undefined && isNewAccount(accountCreatedAt, now) ? buildStartSteps(latestCv, applications) : null;

  const countByStatus = (status: string) =>
    realApplications.filter((app) => app.status === status).length;

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {source === "demo" && (
          <p className="rounded-block bg-amber-100 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-400">
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
            className="rounded-block bg-emerald-50 dark:bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-400/30"
          >
            🎉 Bienvenue en Premium ! Toutes les fonctionnalités IA sont maintenant illimitées.
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted dark:text-slate-400">{todayLabel(now)}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-title break-words text-ink sm:text-4xl dark:text-white">
              Bonjour{accountName ? ` ${accountName.firstName}` : ""}
            </h1>
            <p className="mt-2 text-lg text-muted dark:text-slate-300">
              {!hasRealApplication ? (
                "Commence par ajouter ta première candidature."
              ) : todo.length > 0 ? (
                <>
                  Tu as{" "}
                  <strong className="font-semibold text-ink dark:text-white">{todoCountLabel(todo.length)}</strong>{" "}
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
                  triggerClassName="ui-btn-secondary px-4"
                />
              )}
              {canGoPremium && (
                <Link href="/premium" className="ui-btn-secondary px-4">
                  <IconSparkles className="h-4 w-4" />
                  Passer au Premium
                </Link>
              )}
            </div>
          )}
        </div>

        <OfferLinkForm />

        {betaReport && (
          <p className="ui-block flex flex-wrap items-center gap-x-2 px-4 py-2 text-sm text-ink dark:text-slate-200">
            <span>Rapport à rendre avant le {betaReport.dueLabel}</span>
            <Link
              href="/beta"
              className="ui-link inline-flex min-h-11 items-center underline"
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

        {periodStats && <MyWeekCard stats={periodStats} goal={weeklyGoal.goal} goalEditable={weeklyGoal.available} />}

        {latestCv && (
          <Suspense fallback={null}>
            <OffersForYou sector={latestCv.sector} targetJob={latestCv.targetJob} applied={realApplications} />
          </Suspense>
        )}

        {hasRealApplication && (
          <section aria-labelledby="stats-title" className="space-y-3">
            <h2 id="stats-title" className="text-lg font-semibold tracking-title text-ink dark:text-white">
              Tes chiffres
            </h2>
            <StatsCards
              stats={[
                { label: "Candidatures", value: realApplications.length, tone: "blue" },
                {
                  label: "En attente de réponse",
                  value:
                    countByStatus("envoyee") + countByStatus("en_attente") + countByStatus("relancee"),
                  tone: "waiting",
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
    </div>
  );
}
