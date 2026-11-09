import type { ReactNode } from "react";

/** Décalage entre deux cartes du Tableau de bord. */
const STAGGER_MS = 40;

/**
 * Carte du Tableau de bord qui apparaît au chargement (fondu + 8 px, 250 ms), décalée de 40 ms
 * par rang. Une seule fois par visite : l'animation CSS ne rejoue pas quand la page se rafraîchit.
 * Dans une grille, passer `className="grid min-w-0 grid-cols-1"` : la carte garde toute la hauteur
 * de sa ligne. Carte qui ne rend rien (bloc masqué…) : enveloppe vide masquée, sans espace en plus.
 */
export function Reveal({ index, className = "", children }: { index: number; className?: string; children: ReactNode }) {
  return (
    <div className={`animate-card-in empty:hidden ${className}`.trim()} style={{ animationDelay: `${index * STAGGER_MS}ms` }}>
      {children}
    </div>
  );
}
