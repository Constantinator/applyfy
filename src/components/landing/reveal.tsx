"use client";

import { useEffect, useRef } from "react";

/**
 * Apparition au scroll (landing page) : fondu avec une légère montée à l'entrée dans l'écran, une
 * seule fois. `delay` (ms) décale l'apparition, pour faire venir des cartes l'une après l'autre.
 *
 * Visible par défaut dans le HTML : sans JavaScript, si l'hydratation échoue ou pour un robot, tout
 * reste lisible. Le JavaScript ne masque que les blocs encore sous l'écran, donc sans flash, et ne
 * masque rien si l'utilisateur a réduit les animations.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Déjà à l'écran ou au-dessus (retour en arrière, ancre) : rien à animer.
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.style.transitionDelay = `${delay}ms`;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`data-[reveal=hidden]:translate-y-6 data-[reveal=hidden]:opacity-0 data-[reveal=shown]:transition-[opacity,translate] data-[reveal=shown]:duration-700 data-[reveal=shown]:ease-out ${className}`}
    >
      {children}
    </div>
  );
}
