// Source de vérité des 10 secteurs (offres collectées, base sectorielle cv-knowledge-base.json,
// candidatures). Sans import : utilisable côté navigateur sans embarquer la base sectorielle.

export const SECTORS = [
  "finance",
  "conseil",
  "tech",
  "marketing",
  "creatif",
  "commercial",
  "rh",
  "sante",
  "etudiant",
  "luxe",
] as const;
export type Sector = (typeof SECTORS)[number];

/** Libellé court des pastilles. */
export const SECTOR_LABELS: Record<Sector, string> = {
  finance: "Finance",
  conseil: "Conseil",
  tech: "Tech",
  marketing: "Marketing",
  creatif: "Créatif",
  commercial: "Commercial",
  rh: "RH",
  sante: "Santé",
  etudiant: "Étudiant",
  luxe: "Luxe",
};

/** Libellé d'un secteur vide, inconnu ou nouveau. */
export const OTHER_SECTOR_LABEL = "Autre";

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}
