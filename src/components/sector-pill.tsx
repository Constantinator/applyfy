import { SECTOR_PILL_BASE, sectorTint } from "@/lib/sector-tints";

/**
 * Pastille de secteur : /candidatures (liste, fiche) et Trouver une offre uniquement, jamais dans
 * le Tableau de bord. Secteur vide ou inconnu : pastille grise « Autre ».
 */
export function SectorPill({ sector, className = "" }: { sector: string | null | undefined; className?: string }) {
  const tint = sectorTint(sector);
  return (
    <span className={`${SECTOR_PILL_BASE} ${tint.className} ${className}`}>
      <span className="sr-only">Secteur : </span>
      {tint.label}
    </span>
  );
}
