import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/logo";

export const metadata: Metadata = { title: "Désinscription — Applyfy", robots: { index: false } };

// Confirmation de la désinscription one-click (/api/unsubscribe), ou lien invalide.
export default async function UnsubscribeSuccessPage({ searchParams }: PageProps<"/unsubscribe/success">) {
  const { erreur } = await searchParams;
  const failed = Boolean(erreur);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-4 py-16 dark:bg-slate-950">
      <Link href="/" aria-label="Applyfy, accueil" className="ui-focus mb-8 inline-flex min-h-11 items-center rounded-block">
        <BrandLogo />
      </Link>
      <div className="ui-card w-full max-w-md p-5 sm:p-7 text-center">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] text-ink dark:text-slate-100">
          {failed ? "Lien de désinscription invalide" : "Désinscription confirmée"}
        </h1>
        <p className="mt-3 text-muted dark:text-slate-400">
          {failed
            ? "Ce lien est invalide ou a expiré. Utilise le lien d'un email plus récent, ou contacte-nous."
            : "Tu ne recevras plus d'emails de notre part."}
        </p>
        <Link href="/dashboard" className="ui-btn-primary mt-6">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
