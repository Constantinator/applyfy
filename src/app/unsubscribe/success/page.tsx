import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/logo";

export const metadata: Metadata = { title: "Désinscription — Applyfy", robots: { index: false } };

// Confirmation de la désinscription one-click (/api/unsubscribe), ou lien invalide.
export default async function UnsubscribeSuccessPage({ searchParams }: PageProps<"/unsubscribe/success">) {
  const { erreur } = await searchParams;
  const failed = Boolean(erreur);

  return (
    <main className="flex flex-1 flex-col items-center bg-white px-4 pt-14 pb-20 sm:pt-20 dark:bg-slate-950">
      <div className="ui-card w-full max-w-[480px] px-5 py-8 text-center sm:px-8 sm:py-10">
        <Link
          href="/"
          aria-label="Applyfy, accueil"
          className="ui-focus mx-auto flex h-11 w-11 items-center justify-center rounded-block"
        >
          <BrandMark />
        </Link>
        <h1 className="mt-2 text-[26px] leading-[1.2] font-bold tracking-[-0.03em] text-ink dark:text-slate-100">
          {failed ? "Lien de désinscription invalide" : "Désinscription confirmée"}
        </h1>
        <p className="mt-2 text-[15px] text-muted dark:text-slate-400">
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
