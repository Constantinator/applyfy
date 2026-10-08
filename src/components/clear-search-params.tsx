"use client";

import { useEffect } from "react";

/**
 * Retire les paramètres de l'adresse sans recharger la page : une option d'ouverture
 * (ex. ?depart=cv) ne doit pas se rejouer si l'utilisateur recharge la page.
 */
export function ClearSearchParams() {
  useEffect(() => {
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  return null;
}
