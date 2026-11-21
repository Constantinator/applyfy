"use client";

import { useEffect } from "react";

/**
 * Retire les paramètres de l'adresse sans recharger la page : une option d'ouverture
 * (ex. ?depart=cv) ne doit pas se rejouer si l'utilisateur recharge la page.
 */
export function ClearSearchParams({ keep = "" }: { keep?: string }) {
  useEffect(() => {
    // keep : paramètres gardés tels quels (ex. « accueil=1 » de la phase guidée).
    window.history.replaceState(window.history.state, "", keep ? `${window.location.pathname}?${keep}` : window.location.pathname);
  }, [keep]);
  return null;
}
