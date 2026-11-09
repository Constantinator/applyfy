// Pastilles de secteur : /candidatures (liste, fiche) et Trouver une offre uniquement, jamais dans le
// Tableau de bord. Les valeurs sont les variables CSS --color-sector-* de globals.css ; les classes
// sont écrites en entier pour que Tailwind les détecte.

import { OTHER_SECTOR_LABEL, SECTOR_LABELS, isSector, type Sector } from "./sectors";

/** Valeurs des variables CSS (tests de contraste et d'unicité ; à garder égales à globals.css). */
export const SECTOR_TINT_VALUES: Record<Sector | "other", { bg: string; ink: string }> = {
  finance: { bg: "#e5ebfb", ink: "#112e74" },
  tech: { bg: "#e8e5fb", ink: "#211174" },
  luxe: { bg: "#f8e5fb", ink: "#671174" },
  marketing: { bg: "#fbe5f0", ink: "#741142" },
  creatif: { bg: "#fbf6e5", ink: "#745d11" },
  conseil: { bg: "#f6fbe5", ink: "#607411" },
  etudiant: { bg: "#ecfbe5", ink: "#327411" },
  commercial: { bg: "#e5fbf0", ink: "#117442" },
  rh: { bg: "#e5fbf9", ink: "#11746a" },
  sante: { bg: "#e5f4fb", ink: "#115674" },
  other: { bg: "#f4f4f5", ink: "#3f3f46" },
};

const SECTOR_CLASSES: Record<Sector | "other", string> = {
  finance: "bg-sector-finance text-sector-finance-ink",
  tech: "bg-sector-tech text-sector-tech-ink",
  luxe: "bg-sector-luxe text-sector-luxe-ink",
  marketing: "bg-sector-marketing text-sector-marketing-ink",
  creatif: "bg-sector-creatif text-sector-creatif-ink",
  conseil: "bg-sector-conseil text-sector-conseil-ink",
  etudiant: "bg-sector-etudiant text-sector-etudiant-ink",
  commercial: "bg-sector-commercial text-sector-commercial-ink",
  rh: "bg-sector-rh text-sector-rh-ink",
  sante: "bg-sector-sante text-sector-sante-ink",
  other: "bg-sector-other text-sector-other-ink",
};

/** Forme de la pastille (la couleur vient de sectorTint). */
export const SECTOR_PILL_BASE = "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * Pastille d'un secteur : classes et libellé. Vide, inconnu ou nouveau → gris neutre « Autre »,
 * jamais d'erreur ni de pastille manquante.
 */
export function sectorTint(sector: unknown): { className: string; label: string; known: boolean } {
  if (isSector(sector)) return { className: SECTOR_CLASSES[sector], label: SECTOR_LABELS[sector], known: true };
  return { className: SECTOR_CLASSES.other, label: OTHER_SECTOR_LABEL, known: false };
}
