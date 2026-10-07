"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// Préférence mémorisée dans le navigateur (localStorage) : "1" activé, sinon désactivé
// (par défaut).
const STORAGE_KEY = "applyfy:offres-recommandations";
const CHANGE_EVENT = "applyfy:offres-recommandations-change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback); // autres onglets
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePreference(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour cette page seulement.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Interrupteur « Recommandations personnalisées » de la page « Trouver une offre ».
 * Activé, il ouvre /offres?reco=1 : la page lance une recherche construite à partir des
 * candidatures. Au chargement, la préférence enregistrée est appliquée si aucune recherche
 * manuelle n'est en cours.
 */
export function RecommendationsToggle({
  active,
  canAutoOpen,
  children,
}: {
  /** La page affiche les recommandations (?reco=1). */
  active: boolean;
  /** Ni recherche manuelle ni offre ouverte : la préférence peut être appliquée. */
  canAutoOpen: boolean;
  /** Détail affiché sous l'interrupteur (mots-clés utilisés). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, readPreference, () => false);
  const enabled = active || stored;

  useEffect(() => {
    // Lien ?reco=1 ouvert directement : il fait foi et devient la préférence.
    if (active && !readPreference()) savePreference(true);
    else if (!active && canAutoOpen && readPreference()) router.replace("/offres?reco=1", { scroll: false });
  }, [active, canAutoOpen, router]);

  function toggle() {
    const next = !enabled;
    savePreference(next);
    if (next) router.push("/offres?reco=1", { scroll: false });
    else if (active) router.push("/offres", { scroll: false });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className="group inline-flex items-center gap-3 text-sm font-medium text-slate-700"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-slate-300 group-hover:bg-slate-400"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </span>
        Recommandations personnalisées
      </button>
      {enabled && children}
    </div>
  );
}
