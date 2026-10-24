"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

import { startCheckoutAction } from "@/app/actions/premium";
import { isOnboardingDone } from "@/components/OnboardingModal";
import { PREMIUM_PRICE_FROM_LABEL } from "@/lib/ai-usage-limits";
import { ONBOARDING_OPEN_ATTRIBUTE, notifyOnboardingChange, subscribeOnboarding } from "@/lib/onboarding-tips";
import { PREMIUM_MONTHLY_PLAN, PREMIUM_QUARTERLY_PLAN, QUARTERLY_SAVING_PERCENT } from "@/lib/premium-plans";

const STORAGE_KEY = "welcome_modal_seen";

function hasSeenModal() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // stockage indisponible : pas de popup (elle reviendrait à chaque page)
  }
}

// Ouverte dans cette page : elle le reste jusqu'à sa fermeture, même si la mémoire
// « déjà vue » (écrite dès l'ouverture) change entre-temps.
let openedInThisPage = false;

/**
 * À afficher maintenant ? Une seule fois par navigateur, après la présentation animée
 * (déjà vue, ou fermée : elle enregistre sa fin avant de le signaler).
 */
function shouldShow() {
  return openedInThisPage || (!hasSeenModal() && isOnboardingDone());
}

/** Bouton de paiement d'une offre ; `label` : texte au repos. */
function CheckoutButton({ label, primary }: { label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      autoFocus={primary}
      disabled={pending}
      className={`${primary ? "btn-primary" : "btn-secondary"} w-full px-4 py-2.5 text-sm`}
    >
      {pending ? "Redirection vers le paiement…" : label}
    </button>
  );
}

/** Popup de bienvenue : les deux offres Premium, affichée une seule fois. */
export function WelcomePremiumModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Côté serveur : jamais de popup (la mémoire est dans le navigateur).
  const eligible = useSyncExternalStore(subscribeOnboarding, shouldShow, () => false);
  const [closed, setClosed] = useState(false);
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

  function close() {
    dialogRef.current?.close();
    setClosed(true);
    notifyOnboardingChange(); // les bulles d'aide peuvent apparaître
  }

  if (!open) return null;

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
          Passe au Premium pour utiliser toutes les fonctionnalités IA sans limite.
        </p>

        <p className="mt-6 text-3xl font-bold text-green-600 dark:text-green-400">
          {PREMIUM_PRICE_FROM_LABEL.charAt(0).toUpperCase() + PREMIUM_PRICE_FROM_LABEL.slice(1)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {PREMIUM_QUARTERLY_PLAN.monthlyPrice} €/mois avec l&apos;offre {PREMIUM_QUARTERLY_PLAN.name} (facturé{" "}
          {PREMIUM_QUARTERLY_PLAN.billedAmount} € tous les {PREMIUM_QUARTERLY_PLAN.intervalMonths} mois), ou{" "}
          {PREMIUM_MONTHLY_PLAN.monthlyPrice} €/mois sans engagement.
        </p>

        <div className="mt-6 space-y-2.5">
          <form action={startCheckoutAction.bind(null, PREMIUM_QUARTERLY_PLAN.priceId)}>
            <CheckoutButton
              primary
              label={`${PREMIUM_QUARTERLY_PLAN.name} — ${PREMIUM_QUARTERLY_PLAN.monthlyPrice} €/mois · −${QUARTERLY_SAVING_PERCENT} %`}
            />
          </form>
          <form action={startCheckoutAction.bind(null, PREMIUM_MONTHLY_PLAN.priceId)}>
            <CheckoutButton label={`${PREMIUM_MONTHLY_PLAN.name} — ${PREMIUM_MONTHLY_PLAN.monthlyPrice} €/mois`} />
          </form>
        </div>
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
