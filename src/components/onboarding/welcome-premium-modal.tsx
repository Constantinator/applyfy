"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

import { startCheckoutAction } from "@/app/actions/premium";
import { isOnboardingDone } from "@/components/OnboardingModal";
import { ONBOARDING_OPEN_ATTRIBUTE, notifyOnboardingChange, subscribeOnboarding } from "@/lib/onboarding-tips";

const STORAGE_KEY = "welcome_modal_seen";

/**
 * Fin du prix de lancement : 31 octobre 2026, 23:59:59 heure de Paris (UTC+1 après le
 * passage à l'heure d'hiver). Le 1er novembre, le Premium passe à 10 €/mois pour les
 * nouveaux abonnés ; les abonnements souscrits avant restent à 8 €/mois.
 */
const LAUNCH_OFFER_END = new Date("2026-10-31T23:59:59+01:00").getTime();

function hasSeenModal() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // stockage indisponible : pas de popup (elle reviendrait à chaque page)
  }
}

// Ouverte dans cette page : elle le reste jusqu'à sa fermeture, même si la mémoire
// « déjà vue » (écrite dès l'ouverture) ou la fin de l'offre changent entre-temps.
let openedInThisPage = false;

/**
 * À afficher maintenant ? Une seule fois par navigateur, après la présentation animée
 * (déjà vue, ou fermée : elle enregistre sa fin avant de le signaler) et tant que l'offre
 * de lancement court.
 */
function shouldShow() {
  return openedInThisPage || (!hasSeenModal() && isOnboardingDone() && Date.now() < LAUNCH_OFFER_END);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** « JJ j : HH h : MM min : SS s » */
function formatRemaining(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(days)} j : ${pad(hours)} h : ${pad(minutes)} min : ${pad(seconds)} s`;
}

function CheckoutButton({ expired }: { expired: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" autoFocus disabled={pending} className="btn-primary w-full px-4 py-2.5 text-sm">
      {pending ? "Redirection vers le paiement…" : expired ? "Passer au Premium" : "Passer au Premium — 8 €/mois"}
    </button>
  );
}

/** Popup de bienvenue : prix de lancement du Premium, affichée une seule fois. */
export function WelcomePremiumModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Côté serveur : jamais de popup (la mémoire est dans le navigateur).
  const eligible = useSyncExternalStore(subscribeOnboarding, shouldShow, () => false);
  const [closed, setClosed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const open = eligible && !closed;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    openedInThisPage = true;
    dialog.showModal();
    // Vue dès l'ouverture : elle ne s'affichera plus, même sans clic.
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Stockage indisponible : la popup est simplement fermée pour cette page.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  function close() {
    dialogRef.current?.close();
    setClosed(true);
    notifyOnboardingChange(); // les bulles d'aide peuvent apparaître
  }

  if (!open) return null;

  const remaining = LAUNCH_OFFER_END - now;
  const expired = remaining <= 0;

  return (
    <dialog
      ref={dialogRef}
      {...{ [ONBOARDING_OPEN_ATTRIBUTE]: "" }}
      aria-labelledby="welcome-premium-title"
      aria-describedby="welcome-premium-description"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // Clic sur le fond assombri (en dehors du contenu) : fermeture.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/60 dark:bg-slate-900"
    >
      <div className="p-6 text-center sm:p-8">
        <h2 id="welcome-premium-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Bienvenue sur Applyfy
        </h2>
        <p id="welcome-premium-description" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Prix de lancement : 8 €/mois jusqu&apos;au 31 octobre, puis 10 €/mois pour les nouveaux
          abonnés.
        </p>

        <p className="mt-6 text-3xl font-bold text-green-600 dark:text-green-400">8 €/mois</p>
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          {expired ? (
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Offre expirée</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fin de l&apos;offre dans</p>
              <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums dark:text-white">
                {formatRemaining(remaining)}
              </p>
            </>
          )}
        </div>

        <form action={startCheckoutAction} className="mt-6">
          <CheckoutButton expired={expired} />
        </form>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
        >
          Non merci, continuer gratuitement
        </button>
      </div>
    </dialog>
  );
}
