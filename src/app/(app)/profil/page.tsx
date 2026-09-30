import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AccountNameForm } from "@/components/profile/account-name-form";
import { ProfileCvs } from "@/components/profile/profile-cvs";
import { getAccountName } from "@/lib/account";
import { ReminderSettingsForm } from "@/components/profile/reminder-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { PROFILE_CV_LIMIT } from "@/lib/cv-types";
import { isEmailConfigured } from "@/lib/email/brevo";
import { getReminderSettings, listProfileCvs } from "@/lib/profile";
import { DEFAULT_REMINDER_SETTINGS } from "@/lib/reminders";

export const metadata: Metadata = { title: "Mon profil — Applyfy" };

export default async function ProfilePage() {
  await connection(); // toujours rendu à la requête : la liste des CV change
  const [user, accountName, cvs, reminderSettings] = await Promise.all([
    getCurrentUser(),
    getAccountName(),
    listProfileCvs(),
    // Non bloquant : valeurs par défaut si les préférences sont indisponibles (migration 0008).
    getReminderSettings().catch((error) => {
      console.error("[profil] préférences de rappel", error);
      return DEFAULT_REMINDER_SETTINGS;
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Mon profil</h1>
        {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
      </div>

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
    </main>
  );
}
