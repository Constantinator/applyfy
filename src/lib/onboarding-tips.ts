// Bulles d'aide au premier usage : une bulle vue (cliquée) n'est plus affichée, mémoire
// conservée dans le navigateur (localStorage). Les bulles attendent la fermeture de
// l'écran de bienvenue, signalé par l'attribut data-onboarding-open dans la page.

export const ONBOARDING_OPEN_ATTRIBUTE = "data-onboarding-open";
const CHANGE_EVENT = "applyfy:onboarding-change";
const storageKey = (id: string) => `applyfy:astuce:${id}`;

/** Signale un changement (bulle vue, écran de bienvenue fermé) aux bulles affichées. */
export function notifyOnboardingChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeOnboarding(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback); // autres onglets
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function isTipSeen(id: string) {
  try {
    return window.localStorage.getItem(storageKey(id)) !== null;
  } catch {
    return true; // stockage indisponible (navigation privée stricte…) : pas de bulle
  }
}

/** La bulle doit-elle être affichée maintenant ? */
export function shouldShowTip(id: string) {
  return !isTipSeen(id) && !document.querySelector(`[${ONBOARDING_OPEN_ATTRIBUTE}]`);
}

export function markTipSeen(id: string) {
  try {
    window.localStorage.setItem(storageKey(id), new Date().toISOString());
  } catch {
    // Stockage indisponible : la bulle est simplement masquée pour cette page.
  }
  notifyOnboardingChange();
}
