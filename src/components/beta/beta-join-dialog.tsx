"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { joinBetaAction } from "@/app/actions/beta";
import { BETA_MAX_TESTERS, BETA_PREMIUM_UNTIL_LABEL } from "@/lib/beta-rules";

const CONDITIONS = [
  { title: "Premium gratuit", detail: `Tous les avantages du Premium, offerts jusqu'au ${BETA_PREMIUM_UNTIL_LABEL}.` },
  { title: "Badge « Beta testeur »", detail: "Visible sur ton profil." },
  {
    title: "Engagement : 3 rapports à envoyer",
    detail: "Semaine 1 (sous 7 jours), semaine 2 (sous 14 jours) et mois 1 (sous 30 jours), depuis l'onglet « Beta testing ».",
  },
  {
    title: "Délais obligatoires",
    detail: "Un rapport non envoyé à temps retire automatiquement ton accès beta et le Premium offert.",
  },
];

/**
 * « Devenir beta testeur » : bouton et fenêtre des conditions du programme.
 * - `join` (dashboard) : la confirmation inscrit directement l'utilisateur connecté ;
 * - `link` (landing page) : la confirmation mène au dashboard (connexion si besoin), où la
 *   fenêtre se rouvre pour confirmer.
 */
export function BetaJoinDialog({
  mode,
  spotsLeft = null,
  autoOpen = false,
  triggerClassName = "ui-btn-secondary",
}: {
  mode: "join" | "link";
  /** Places restantes (inconnues sur la landing page). */
  spotsLeft?: number | null;
  /** Ouvrir dès l'affichage (retour depuis la landing page). */
  autoOpen?: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [pending, startTransition] = useTransition();
  const full = spotsLeft === 0;

  useEffect(() => {
    if (autoOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [autoOpen]);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close(); // onClose retire ?beta= de l'adresse
  }

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await joinBetaAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJoined(true);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={open} className={triggerClassName}>
        Devenir beta testeur
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="beta-title"
        // Retour depuis la landing page : à la fermeture, ?beta= ne doit pas rouvrir la fenêtre.
        onClose={() => {
          if (autoOpen) router.replace("/dashboard", { scroll: false });
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card border border-line bg-white p-0 text-left backdrop:bg-[rgba(10,10,10,0.45)]"
      >
        <div className="px-5 pt-7 sm:px-7">
          <p className="text-sm font-medium text-muted">Programme beta · {BETA_MAX_TESTERS} places</p>
          <h2 id="beta-title" className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-ink">
            Deviens beta testeur
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            Aide-nous à construire Applyfy et profite du Premium gratuitement.
          </p>
        </div>

        {joined ? (
          <div className="space-y-4 px-5 py-8 text-center sm:px-7">
            <p className="text-3xl" aria-hidden="true">
              🎉
            </p>
            <p role="status" className="font-semibold text-ink">
              Bienvenue dans la beta !
            </p>
            <p className="text-sm text-muted">
              Ton Premium est actif. Retrouve tes 3 rapports à envoyer dans l&apos;onglet « Beta testing ».
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/beta" className="ui-btn-primary">
                Voir mes rapports
              </Link>
              <button type="button" onClick={close} className="ui-btn-secondary">
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-5 pt-5 pb-7 sm:px-7">
            <ul className="space-y-3">
              {CONDITIONS.map((condition) => (
                <li key={condition.title} className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-0.5 font-bold text-accent">
                    ✓
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{condition.title}</span>
                    <span className="text-muted">{condition.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            {spotsLeft !== null && (
              <p className="text-sm font-medium text-ink">
                {full
                  ? "Les 30 places sont prises : le programme est complet."
                  : `${spotsLeft} place${spotsLeft > 1 ? "s" : ""} restante${spotsLeft > 1 ? "s" : ""} sur ${BETA_MAX_TESTERS}.`}
              </p>
            )}

            {error && (
              <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              {mode === "join" ? (
                <button
                  type="button"
                  onClick={join}
                  disabled={pending || full}
                  className="ui-btn-primary"
                >
                  {pending ? "Inscription…" : "Je m'engage et je rejoins la beta"}
                </button>
              ) : (
                <Link href="/dashboard?beta=rejoindre" className="ui-btn-primary text-center">
                  Je m&apos;engage et je rejoins la beta
                </Link>
              )}
              <button type="button" onClick={close} className="ui-btn-secondary">
                Annuler
              </button>
            </div>
            {mode === "link" && (
              <p className="text-xs text-muted">
                Tu te connecteras (ou créeras ton compte) pour confirmer ton inscription.
              </p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
