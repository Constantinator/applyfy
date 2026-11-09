import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import { CvCard, type LatestCv } from "@/components/dashboard/cv-card";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { GoogleAdsConversion } from "@/components/dashboard/google-ads-conversion";
import { LumeoBanner } from "@/components/dashboard/lumeo-banner";
import { FreePlanCard } from "@/components/dashboard/free-plan-card";
import { MyWeekCard } from "@/components/dashboard/my-week-card";
import { OfferLinkForm } from "@/components/dashboard/offer-link-form";
import { OffersForYou } from "@/components/dashboard/offers-for-you";
import { Reveal } from "@/components/dashboard/reveal";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TodoCard } from "@/components/dashboard/todo-card";
import { getAccountCreatedAt, getAccountName } from "@/lib/account";
import { isAdminEmail } from "@/lib/admin-metrics";
import { getFreePlanCounts } from "@/lib/ai-usage";
import { getApplications, getResponseEvents } from "@/lib/applications";
import { getCurrentUser } from "@/lib/auth";
import { getBetaSpotsLeft, getMyBeta } from "@/lib/beta";
import { pendingBetaReport } from "@/lib/beta-rules";
import { getLatestBuilderCv } from "@/lib/cv-builder";
import { targetJobOf } from "@/lib/cv-builder-types";
import { scoreCv, weakestCategory } from "@/lib/cv-score";
import { loadScoringContext } from "@/lib/cv-score-context";
import { buildStartSteps, isNewAccount } from "@/lib/dashboard-start";
import { buildTodo, todayLabel, todoCountLabel } from "@/lib/dashboard-todo";
import { buildPeriodStats } from "@/lib/dashboard-week";
import { FOLLOW_UP_AFTER_DAYS, needsFollowUp } from "@/lib/follow-up";
import { isFreeAccount } from "@/lib/free-plan";
import { pickLumeoMessage } from "@/lib/lumeo-dashboard";
import { getWeeklyGoal } from "@/lib/profile";
import { isStripeConfigured, syncCheckoutSession } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";

export const metadata: Metadata = { title: "Tableau de bord — Applyfy" };

/** Paramètres de l'ancienne liste, qui était sur /dashboard : favoris et e-mails déjà envoyés. */
const LIST_PARAMS = ["filtre", "tri", "ajout", "suppression"];

/** Section « Tes chiffres » : masquée (doublon de « Ma semaine » et « À faire »), prête à revenir. */
const SHOW_STATS: boolean = false;

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
  // Programme beta : proposé à ceux qui n'y participent pas encore.
  const canJoinBeta = source !== "demo" && !beta;
  const betaSpotsLeft = canJoinBeta ? await getBetaSpotsLeft() : 0;
  const freeAccount = isFreeAccount({
    premium: subscription?.premium ?? false,
    betaActive: beta?.status === "active",
    admin: isAdminEmail((await getCurrentUser())?.email),
  });
  const freePlanCounts = freeAccount ? await getFreePlanCounts() : null;
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

  // Bandeau de Lumeo : un message à la fois, à partir des données déjà lues (aucune requête).
  const lumeoMessage = pickLumeoMessage({
    hasCv: latestCv === undefined ? undefined : latestCv !== null,
    applications,
    weekSent: periodStats ? periodStats.week.sent : null,
    weeklyGoal: weeklyGoal.goal,
    now,
  });
  // Cartes : apparition décalée de 40 ms, dans l'ordre de la page.
  let revealIndex = 1;
  const nextReveal = () => revealIndex++;

  const countByStatus = (status: string) =>
    realApplications.filter((app) => app.status === status).length;

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        {source === "demo" && (
          <p className="ui-notice px-4 py-2 text-sm">
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
            className="ui-notice px-4 py-2 text-sm font-medium"
          >
            🎉 Bienvenue en Premium ! Tes quotas mensuels et la limite du Chat IA sont levés.
          </p>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted dark:text-slate-400">{todayLabel(now)}</p>
            <h1 className="mt-1 text-[40px] leading-[1.1] font-bold tracking-[-0.035em] break-words text-ink dark:text-white">
              Bonjour{accountName ? ` ${accountName.firstName}` : ""}
            </h1>
            <p className="mt-2 text-[17px] text-muted dark:text-slate-300">
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
          <OfferLinkForm />
        </div>

        {lumeoMessage && <LumeoBanner message={lumeoMessage} />}

        {betaReport && (
          <p className="ui-notice flex flex-wrap items-center gap-x-2 px-4 py-2 text-sm">
            <span>Rapport à rendre avant le {betaReport.dueLabel}</span>
            <Link
              href="/beta"
              className="ui-link inline-flex min-h-11 items-center underline"
            >
              Écrire le rapport
            </Link>
          </p>
        )}

        <div className={`grid gap-8 ${latestCv === undefined ? "" : "lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]"}`}>
          {/* Enveloppes en grille d'une colonne : chaque carte garde la hauteur de la ligne. */}
          <Reveal index={nextReveal()} className="grid min-w-0 grid-cols-1">
            <TodoCard items={todo} hasRealApplication={hasRealApplication} />
          </Reveal>
          {/* Lecture du CV en échec : pas de carte, plutôt qu'un « Crée ton CV » trompeur. */}
          {latestCv !== undefined && (
            <Reveal index={nextReveal()} className="grid min-w-0 grid-cols-1">
              <CvCard cv={latestCv} />
            </Reveal>
          )}
        </div>

        {startSteps && (
          <Reveal index={nextReveal()}>
            <GettingStarted steps={startSteps} />
          </Reveal>
        )}

        {periodStats && (
          <Reveal index={nextReveal()}>
            <MyWeekCard stats={periodStats} goal={weeklyGoal.goal} goalEditable={weeklyGoal.available} />
          </Reveal>
        )}

        {latestCv && (
          <Suspense fallback={null}>
            <Reveal index={nextReveal()}>
              <OffersForYou sector={latestCv.sector} targetJob={latestCv.targetJob} applied={realApplications} />
            </Reveal>
          </Suspense>
        )}

        {SHOW_STATS && hasRealApplication && (
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

        {/* Masquée si la lecture des compteurs échoue : pas de faux chiffres. */}
        {freePlanCounts && (
          <Reveal index={nextReveal()}>
            <FreePlanCard counts={freePlanCounts} />
          </Reveal>
        )}

        {canJoinBeta && (
          <Reveal index={nextReveal()}>
            <section aria-labelledby="beta-invite-title" className="ui-card p-5 sm:p-7">
              <h2 id="beta-invite-title" className="ui-title">
                Deviens beta testeur
              </h2>
              <p className="mt-2 mb-5 text-sm text-muted dark:text-slate-300">
                Aide-nous à construire Applyfy et profite du Premium gratuitement.
              </p>
              <BetaJoinDialog
                mode="join"
                spotsLeft={betaSpotsLeft}
                autoOpen={betaParam === "rejoindre"}
                triggerClassName="ui-btn-secondary"
              />
            </section>
          </Reveal>
        )}
      </main>
    </div>
  );
}
