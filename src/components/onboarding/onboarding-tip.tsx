"use client";

import { useSyncExternalStore } from "react";

import { markTipSeen, shouldShowTip, subscribeOnboarding } from "@/lib/onboarding-tips";

/**
 * Bulle d'aide affichée sous un élément au premier usage. Disparaît définitivement dès
 * qu'on clique sur la bulle ou sur l'élément.
 */
export function OnboardingTip({
  id,
  text,
  align = "center",
  className = "",
  children,
}: {
  /** Identifiant stable (mémorisé dans le navigateur une fois la bulle vue). */
  id: string;
  text: string;
  /** Alignement horizontal de la bulle par rapport à l'élément (cf. position ci-dessous). */
  align?: "center" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  // Côté serveur : jamais de bulle (la mémoire est dans le navigateur).
  const visible = useSyncExternalStore(subscribeOnboarding, () => shouldShowTip(id), () => false);

  // "end" : aligné à droite à partir de sm (élément en bout de ligne), à gauche sur mobile
  // (l'élément y passe à la ligne, à gauche) pour ne jamais sortir de l'écran.
  const position = align === "end" ? "left-0 sm:right-0 sm:left-auto" : "left-1/2 -translate-x-1/2";
  const arrow = align === "end" ? "left-6 sm:right-6 sm:left-auto" : "left-1/2 -translate-x-1/2";

  return (
    <span className={`relative inline-flex ${className}`} onClickCapture={visible ? () => markTipSeen(id) : undefined}>
      {children}
      {visible && (
        <button
          type="button"
          onClick={() => markTipSeen(id)}
          className={`animate-tip-in absolute top-full z-30 mt-3 w-max max-w-[16rem] rounded-xl bg-slate-900 px-3.5 py-2.5 text-left text-sm font-medium text-white shadow-lg shadow-slate-900/20 ${position}`}
        >
          <span aria-hidden="true" className={`absolute -top-1.5 h-3 w-3 rotate-45 bg-slate-900 ${arrow}`} />
          <span className="relative">{text}</span>
          <span className="relative mt-1 block text-xs font-normal text-slate-300">Compris, merci</span>
        </button>
      )}
    </span>
  );
}
