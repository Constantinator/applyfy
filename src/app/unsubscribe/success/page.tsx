import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Désinscription — Applyfy", robots: { index: false } };

// Confirmation de la désinscription one-click (/api/unsubscribe), ou lien invalide.
export default async function UnsubscribeSuccessPage({ searchParams }: PageProps<"/unsubscribe/success">) {
  const { erreur } = await searchParams;
  const failed = Boolean(erreur);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="Applyfy, accueil" className="mb-8">
        <Logo />
      </Link>
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {failed ? "Lien de désinscription invalide" : "Désinscription confirmée"}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {failed
            ? "Ce lien est invalide ou a expiré. Utilise le lien d'un email plus récent, ou contacte-nous."
            : "Tu ne recevras plus d'emails de notre part."}
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">
          Retour au dashboard
        </Link>
      </div>
    </main>
  );
}
