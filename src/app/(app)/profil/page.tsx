import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ProfileCvForm } from "@/components/profile/profile-cv-form";
import { getCurrentUser } from "@/lib/auth";
import { getProfileCv } from "@/lib/profile";

export const metadata: Metadata = { title: "Mon profil — Applyfy" };

export default async function ProfilePage() {
  await connection(); // toujours rendu à la requête : l'état du CV change
  const [user, cv] = await Promise.all([getCurrentUser(), getProfileCv()]);

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
            Mon CV
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Importe ton CV une seule fois : tu pourras ensuite l&apos;utiliser dans « Adapter mon
            CV » sur chaque candidature, sans le renvoyer.
          </p>
        </div>
        <ProfileCvForm cv={cv} />
        <p className="text-xs text-slate-500">
          Ton CV est stocké de façon privée : toi seul·e y as accès. Lors d&apos;une analyse, il est
          transmis à Claude (Anthropic).
        </p>
      </section>
    </main>
  );
}
