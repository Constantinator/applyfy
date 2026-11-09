import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { openBillingPortalAction } from "@/app/actions/premium";
import { AccountNameForm } from "@/components/profile/account-name-form";
import { DeleteAccount } from "@/components/profile/delete-account";
import { EmailSubscriptionToggle } from "@/components/profile/email-subscription-toggle";
import { ProfileCvs } from "@/components/profile/profile-cvs";
import { getAccountName } from "@/lib/account";
import { PREMIUM_PRICE_FROM_LABEL } from "@/lib/ai-usage-limits";
import { ReminderSettingsForm } from "@/components/profile/reminder-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { PROFILE_CV_LIMIT } from "@/lib/cv-types";
import { isEmailConfigured } from "@/lib/email/brevo";
import { getEmailsSubscribed } from "@/lib/email-preferences";
import { getReminderSettings, listProfileCvs } from "@/lib/profile";
import { DEFAULT_REMINDER_SETTINGS } from "@/lib/reminders";
import { getSubscription } from "@/lib/subscription";

export const metadata: Metadata = { title: "Mon profil — Applyfy" };

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function ProfilePage({ searchParams }: PageProps<"/profil">) {
  await connection(); // toujours rendu à la requête : la liste des CV change
  const { abonnement } = await searchParams;
  const [user, accountName, cvs, reminderSettings, subscription, emailsSubscribed] = await Promise.all([
    getCurrentUser(),
    getAccountName(),
    listProfileCvs(),
    // Non bloquant : valeurs par défaut si les préférences sont indisponibles (migration 0008).
    getReminderSettings().catch((error) => {
      console.error("[profil] préférences de rappel", error);
      return DEFAULT_REMINDER_SETTINGS;
    }),
    getSubscription(),
    getEmailsSubscribed().catch((error) => {
      console.error("[profil] préférence e-mails", error);
      return true;
    }),
  ]);
  const beta = await getMyBeta();
  const stripePremium = subscription?.premium ?? false;
  const betaPremium = hasBetaPremium(beta);
  const premium = stripePremium || betaPremium;
  const periodEnd = subscription?.currentPeriodEnd
    ? longDate.format(new Date(subscription.currentPeriodEnd))
    : null;
  let planDescription = `Quotas IA par mois, et par jour pour le coach. Premium ${PREMIUM_PRICE_FROM_LABEL} : plus de quotas mensuels.`;
  if (betaPremium && !stripePremium && beta) {
    planDescription = `Premium offert en tant que beta testeur, jusqu'au ${longDate.format(new Date(`${beta.premiumUntil}T12:00:00Z`))}.`;
  } else if (premium) {
    planDescription =
      subscription?.cancelAtPeriodEnd && periodEnd
        ? `Résiliation programmée : ton Premium reste actif jusqu'au ${periodEnd}.`
        : subscription?.status === "past_due"
          ? "Le dernier paiement a échoué : mets à jour ton moyen de paiement pour garder le Premium."
          : `Plus de quotas mensuels${periodEnd ? `, renouvellement le ${periodEnd}` : ""}.`;
  }

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page-narrow flex-1 space-y-5">
        <Link href="/dashboard" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
          Retour au tableau de bord
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">Mon profil</h1>
            {beta?.status === "active" && (
              <span className="bg-ink rounded-full px-3 py-1 text-xs font-semibold text-white">
                Beta testeur
              </span>
            )}
          </div>
          {user?.email && <p className="mt-1 text-sm text-muted dark:text-slate-400">{user.email}</p>}
        </div>

        <section aria-labelledby="identite-title" className="space-y-4 ui-card p-5 sm:p-7">
          <div>
            <h2 id="identite-title" className="ui-title-sm">
              Prénom et nom
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Utilisés pour signer tes lettres de motivation et remplir leur objet.
            </p>
          </div>
          <AccountNameForm initial={accountName} />
        </section>

        <section
          aria-labelledby="rappels-title"
          className="space-y-4 ui-card p-5 sm:p-7"
        >
          <div>
            <h2 id="rappels-title" className="ui-title-sm">
              Rappels de relance
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Reçois un email quand il est temps de relancer une candidature restée sans réponse
              {user?.email ? ` (envoyé à ${user.email})` : ""}.
            </p>
          </div>
          <ReminderSettingsForm initial={reminderSettings} emailEnabled={isEmailConfigured()} />
        </section>

        <section aria-labelledby="emails-title" className="space-y-4 ui-card p-5 sm:p-7">
          <h2 id="emails-title" className="ui-title-sm">
            E-mails
          </h2>
          <EmailSubscriptionToggle initial={emailsSubscribed} />
        </section>

        <section aria-labelledby="abonnement-title" className="space-y-4 ui-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="abonnement-title" className="ui-title-sm">
                Mon abonnement
              </h2>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">{planDescription}</p>
            </div>
            <span
              className="rounded-full bg-pill px-3 py-1 text-sm font-semibold text-ink dark:bg-slate-800 dark:text-slate-200"
            >
              {premium ? "Premium" : "Gratuit"}
            </span>
          </div>
          {abonnement === "indisponible" && (
            <p role="alert" className="ui-notice-error px-4 py-3 text-sm">
              La gestion de l&apos;abonnement n&apos;a pas pu s&apos;ouvrir. Réessaie dans un instant.
            </p>
          )}
          {stripePremium ? (
            <form action={openBillingPortalAction}>
              <button type="submit" className="ui-btn-secondary">
                Gérer mon abonnement
              </button>
            </form>
          ) : (
            !premium && (
              <Link href="/premium" className="ui-btn-primary inline-flex">
                Passer au Premium
              </Link>
            )
          )}
        </section>

        <section
          aria-labelledby="profil-cv-title"
          className="space-y-4 ui-card p-5 sm:p-7"
        >
          <div>
            <h2 id="profil-cv-title" className="ui-title-sm">
              Mes CV
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Enregistre jusqu&apos;à {PROFILE_CV_LIMIT} CV (ex. « CV Data », « CV Marketing ») : tu
              choisiras lequel utiliser dans « Adapter mon CV » sur chaque candidature.
            </p>
          </div>
          <ProfileCvs cvs={cvs} />
          <p className="text-xs text-muted dark:text-slate-400">
            Tes CV sont stockés de façon privée : toi seul·e y as accès. Lors d&apos;une analyse, le CV
            choisi est transmis à Claude (Anthropic).
          </p>
        </section>

        <section
          aria-labelledby="danger-title"
          className="ui-card space-y-4 p-5 sm:p-7"
        >
          <div>
            <h2 id="danger-title" className="ui-title-sm">
              Zone dangereuse
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-300">
              Supprime définitivement ton compte Applyfy et toutes tes données : candidatures,
              historique, CV, lettres et préférences. Cette action est irréversible.
            </p>
          </div>
          <DeleteAccount />
        </section>
      </main>
    </div>
  );
}
