import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { openBillingPortalAction } from "@/app/actions/premium";
import { AccountNameForm } from "@/components/profile/account-name-form";
import { DeleteAccount } from "@/components/profile/delete-account";
import { ProfileCvs } from "@/components/profile/profile-cvs";
import { UsageOverview } from "@/components/profile/usage-overview";
import { getAccountName } from "@/lib/account";
import { readAiUsage } from "@/lib/ai-usage";
import { PREMIUM_PRICE_LABEL } from "@/lib/ai-usage-limits";
import { ReminderSettingsForm } from "@/components/profile/reminder-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { getMyBeta, hasBetaPremium } from "@/lib/beta";
import { PROFILE_CV_LIMIT } from "@/lib/cv-types";
import { isEmailConfigured } from "@/lib/email/brevo";
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
  const [user, accountName, cvs, reminderSettings, usage, subscription] = await Promise.all([
    getCurrentUser(),
    getAccountName(),
    listProfileCvs(),
    // Non bloquant : valeurs par défaut si les préférences sont indisponibles (migration 0008).
    getReminderSettings().catch((error) => {
      console.error("[profil] préférences de rappel", error);
      return DEFAULT_REMINDER_SETTINGS;
    }),
    readAiUsage(),
    getSubscription(),
  ]);
  const beta = await getMyBeta();
  const stripePremium = subscription?.premium ?? false;
  const betaPremium = hasBetaPremium(beta);
  const premium = stripePremium || betaPremium;
  const periodEnd = subscription?.currentPeriodEnd
    ? longDate.format(new Date(subscription.currentPeriodEnd))
    : null;
  let planDescription = `Limites mensuelles par fonctionnalité IA. Premium à ${PREMIUM_PRICE_LABEL} : accès illimité.`;
  if (betaPremium && !stripePremium && beta) {
    planDescription = `Premium offert en tant que beta testeur, jusqu'au ${longDate.format(new Date(`${beta.premiumUntil}T12:00:00Z`))}.`;
  } else if (premium) {
    planDescription =
      subscription?.cancelAtPeriodEnd && periodEnd
        ? `Résiliation programmée : ton Premium reste actif jusqu'au ${periodEnd}.`
        : subscription?.status === "past_due"
          ? "Le dernier paiement a échoué : mets à jour ton moyen de paiement pour garder le Premium."
          : `Fonctionnalités IA illimitées${periodEnd ? `, renouvellement le ${periodEnd}` : ""}.`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Mon profil</h1>
          {beta?.status === "active" && (
            <span className="bg-brand-gradient rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Beta testeur
            </span>
          )}
        </div>
        {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
      </div>

      <section aria-labelledby="abonnement-title" className="space-y-4 card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="abonnement-title" className="font-semibold text-slate-900">
              Mon abonnement
            </h2>
            <p className="mt-1 text-sm text-slate-500">{planDescription}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
              premium ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-slate-100 text-slate-700 ring-slate-200"
            }`}
          >
            {premium ? "Premium" : "Gratuit"}
          </span>
        </div>
        {abonnement === "indisponible" && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            La gestion de l&apos;abonnement n&apos;a pas pu s&apos;ouvrir. Réessaie dans un instant.
          </p>
        )}
        {stripePremium ? (
          <form action={openBillingPortalAction}>
            <button type="submit" className="btn-secondary px-4 py-2 text-sm">
              Gérer mon abonnement
            </button>
          </form>
        ) : (
          !premium && (
            <Link href="/premium" className="btn-primary inline-flex px-4 py-2 text-sm">
              Passer au Premium
            </Link>
          )
        )}
      </section>

      <section aria-labelledby="identite-title" className="space-y-4 card p-5 sm:p-6">
        <div>
          <h2 id="identite-title" className="font-semibold text-slate-900">
            Prénom et nom
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Utilisés pour signer tes lettres de motivation et remplir leur objet.
          </p>
        </div>
        <AccountNameForm initial={accountName} />
      </section>

      <section
        aria-labelledby="profil-cv-title"
        className="space-y-4 card p-5 sm:p-6"
      >
        <div>
          <h2 id="profil-cv-title" className="font-semibold text-slate-900">
            Mes CV
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enregistre jusqu&apos;à {PROFILE_CV_LIMIT} CV (ex. « CV Data », « CV Marketing ») : tu
            choisiras lequel utiliser dans « Adapter mon CV » sur chaque candidature.
          </p>
        </div>
        <ProfileCvs cvs={cvs} />
        <p className="text-xs text-slate-500">
          Tes CV sont stockés de façon privée : toi seul·e y as accès. Lors d&apos;une analyse, le CV
          choisi est transmis à Claude (Anthropic).
        </p>
      </section>

      <section aria-labelledby="utilisation-title" className="space-y-4 card p-5 sm:p-6">
        <div>
          <h2 id="utilisation-title" className="font-semibold text-slate-900">
            Mon utilisation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {premium ? (
              "Premium : toutes les fonctionnalités IA sont illimitées."
            ) : (
              <>
                Plan gratuit : limites mensuelles par fonctionnalité IA (regénérations comprises).
                Premium à {PREMIUM_PRICE_LABEL} : accès illimité.
              </>
            )}
          </p>
        </div>
        <UsageOverview usage={usage} />
      </section>

      <section
        aria-labelledby="rappels-title"
        className="space-y-4 card p-5 sm:p-6"
      >
        <div>
          <h2 id="rappels-title" className="font-semibold text-slate-900">
            Rappels de relance
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Reçois un email quand il est temps de relancer une candidature restée sans réponse
            {user?.email ? ` (envoyé à ${user.email})` : ""}.
          </p>
        </div>
        <ReminderSettingsForm initial={reminderSettings} emailEnabled={isEmailConfigured()} />
      </section>

      <section
        aria-labelledby="danger-title"
        className="space-y-4 rounded-2xl border border-red-200 bg-red-50/40 p-5 sm:p-6"
      >
        <div>
          <h2 id="danger-title" className="font-semibold text-red-700">
            Zone dangereuse
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Supprime définitivement ton compte Applyfy et toutes tes données : candidatures,
            historique, CV, lettres et préférences. Cette action est irréversible.
          </p>
        </div>
        <DeleteAccount />
      </section>
    </main>
  );
}
