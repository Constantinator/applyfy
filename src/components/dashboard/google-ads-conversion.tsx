"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

const CONVERSION = {
  send_to: "AW-18509978707/TmN4COyC95odENO4n_pE",
  // Prix de l'abonnement Premium mensuel (PREMIUM_PRICE_LABEL, src/lib/ai-usage-limits.ts).
  value: 8.0,
  currency: "EUR",
};

type Gtag = (command: "event", name: "conversion", params: Record<string, unknown>) => void;

/**
 * Conversion Google Ads au retour de Stripe Checkout (/dashboard?premium=bienvenue). Envoyée
 * seulement si la balise Google Ads est chargée, c'est-à-dire si le visiteur a accepté les
 * cookies publicitaires, et une seule fois par paiement (rechargement de la page compris).
 */
export function GoogleAdsConversion() {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("premium") === "bienvenue";
  const sessionId = searchParams.get("session_id") ?? "";

  useEffect(() => {
    if (!welcome) return;
    const sentKey = `applyfy-ads-conversion:${sessionId}`;
    try {
      if (window.sessionStorage.getItem(sentKey)) return;
    } catch {
      // Stockage indisponible : la conversion sera au plus envoyée à chaque chargement.
    }

    // gtag est défini par un script chargé après la page : on l'attend quelques secondes.
    let attempts = 0;
    const timer = window.setInterval(() => {
      const gtag = (window as unknown as { gtag?: Gtag }).gtag;
      if (typeof gtag !== "undefined") {
        window.clearInterval(timer);
        // transaction_id : Google ignore une conversion déjà reçue pour ce paiement.
        gtag("event", "conversion", { ...CONVERSION, transaction_id: sessionId || undefined });
        try {
          window.sessionStorage.setItem(sentKey, "1");
        } catch {
          // Voir plus haut.
        }
      } else if (++attempts >= 40) {
        window.clearInterval(timer); // ~10 s : cookies refusés, ou balise bloquée.
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [welcome, sessionId]);

  return null;
}
