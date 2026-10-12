"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1600;

/**
 * Chiffre de la landing qui compte de 0 jusqu'à sa valeur quand il arrive à l'écran
 * (ex. « 75 % », « 14 jours » : le nombre du début est animé, la suite reste fixe).
 * La valeur finale est rendue côté serveur (référencement, sans JavaScript) et lue par
 * les lecteurs d'écran ; sans animation si l'utilisateur les a réduites.
 */
export function CountUp({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const match = /^(\d+)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : null;
  const suffix = match ? match[2] : "";
  const ref = useRef<HTMLParagraphElement>(null);
  const [current, setCurrent] = useState<number | null>(target);

  useEffect(() => {
    const element = ref.current;
    if (!element || target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Premier appel hors écran (section sous la ligne de flottaison) : remis à 0 en attendant.
        if (!entry.isIntersecting) {
          setCurrent(0);
          return;
        }
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          // Décélération en fin de course (ease-out cubique).
          setCurrent(Math.round(target * (1 - (1 - progress) ** 3)));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <p ref={ref} className={`tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {target === null ? value : `${current}${suffix}`}
      </span>
    </p>
  );
}
