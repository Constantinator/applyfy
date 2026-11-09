import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/logo";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

export const metadata: Metadata = { title: "Désinscription — Applyfy", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Confirmation avant désinscription (lien des e-mails, via GET /api/unsubscribe). Lecture seule :
// le jeton est vérifié, mais seul le bouton (POST /api/unsubscribe) enregistre la désinscription.
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { token, uid } = await searchParams;
  const valid =
    typeof token === "string" && typeof uid === "string" && UUID.test(uid) && verifyUnsubscribeToken(token, uid);
  const action = valid ? `/api/unsubscribe?${new URLSearchParams({ token, uid })}` : "";

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
          {valid ? "Te désinscrire des e-mails ?" : "Lien de désinscription invalide"}
        </h1>
        {valid ? (
          <>
            <p className="mt-2 text-[15px] text-muted dark:text-slate-400">
              Tu ne recevras plus nos e-mails de bienvenue, d&apos;activation, de rappel de relance ni les messages de
              l&apos;équipe. Les e-mails de service liés à ton compte ou à ton accès bêta peuvent continuer.
            </p>
            <form method="post" action={action} className="mt-6 flex flex-col items-center gap-2">
              <button type="submit" className="ui-btn-primary">
                Confirmer ma désinscription
              </button>
              <Link href="/" className="ui-focus inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink">
                Annuler
              </Link>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-[15px] text-muted dark:text-slate-400">
              Ce lien est invalide ou a expiré. Utilise le lien d&apos;un email plus récent, ou gère tes e-mails depuis
              ton profil.
            </p>
            <Link href="/profil" className="ui-btn-primary mt-6">
              Aller à mon profil
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
