import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/logo";

export const metadata: Metadata = { title: "Désinscription — Applyfy", robots: { index: false } };

// Après le bouton de /unsubscribe (POST /api/unsubscribe) : désinscription enregistrée, ou lien invalide.
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
          {failed ? "Lien de désinscription invalide" : "Désinscription enregistrée"}
        </h1>
        <p className="mt-2 text-[15px] text-muted dark:text-slate-400">
          {failed
            ? "Ce lien est invalide ou a expiré. Utilise le lien d'un email plus récent, ou gère tes e-mails depuis ton profil."
            : "Tu ne recevras plus nos e-mails de bienvenue, d'activation, de rappel de relance ni les messages de l'équipe. Les e-mails de service liés à ton compte ou à ton accès bêta (confirmation d'adresse, rappels de rapport, suspension) peuvent continuer."}
        </p>
        {!failed && (
          <p className="mt-2 text-[15px] text-muted dark:text-slate-400">
            Tu peux te réinscrire à tout moment depuis{" "}
            <Link href="/profil" className="ui-focus text-accent underline">
              ton profil
            </Link>
            .
          </p>
        )}
        <Link href="/dashboard" className="ui-btn-primary mt-6">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
