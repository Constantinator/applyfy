"use client";

import { useLayoutEffect, useState } from "react";

import { ScoreGauge } from "@/components/cv-builder/cv-score-card";
import { localDay } from "@/lib/lumeo-dashboard";

const STORAGE_KEY = "applyfy:score-anime";
const DURATION_MS = 250;

/**
 * Jauge de la carte « Ton CV » : à la première vue du jour, le chiffre compte de 0 au score
 * pendant que la jauge se remplit (250 ms). Rendu serveur, mouvement réduit ou stockage
 * indisponible : le score final directement.
 */
export function AnimatedScoreGauge({ score }: { score: number }) {
  const [shown, setShown] = useState(score);

  useLayoutEffect(() => {
    if (score <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const today = localDay(new Date());
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === today) return;
      window.localStorage.setItem(STORAGE_KEY, today);
    } catch {
      return;
    }

    // Avant l'affichage : la jauge part de 0, sans montrer le score final une fraction de seconde.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remise à 0 voulue avant l'affichage (useLayoutEffect), une fois par jour
    setShown(0);
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / DURATION_MS);
      // Décélération douce, sans dépassement.
      setShown(Math.round(score * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setShown(score);
    };
  }, [score]);

  return <ScoreGauge score={score} shown={shown} size="card" />;
}
