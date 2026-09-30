import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ProfileCvs } from "@/components/profile/profile-cvs";
import { getCurrentUser } from "@/lib/auth";
import { PROFILE_CV_LIMIT } from "@/lib/cv-types";
import { listProfileCvs } from "@/lib/profile";

export const metadata: Metadata = { title: "Mon profil — Applyfy" };

export default async function ProfilePage() {
  await connection(); // toujours rendu à la requête : la liste des CV change
  const [user, cvs] = await Promise.all([getCurrentUser(), listProfileCvs()]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Mon profil</h1>
        {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
      </div>

      <section
        aria-labelledby="profil-cv-title"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
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
    </main>
  );
}
