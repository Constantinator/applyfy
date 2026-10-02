// Personnalisation du CV amélioré (police, taille, couleur d'accent, mise en page).
// Partagé entre l'éditeur (client) et l'enregistrement (serveur).

// Ordre d'affichage dans le sélecteur de police. Les polices web (var(--font-…)) sont
// chargées par lib/cv-fonts sur les pages de l'éditeur.
export const CV_FONTS = {
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  garamond: { label: "Garamond", stack: "var(--font-garamond), Garamond, 'Times New Roman', serif" },
  inter: { label: "Inter", stack: "var(--font-inter), Arial, Helvetica, sans-serif" },
  calibri: { label: "Calibri", stack: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  playfair: { label: "Playfair Display", stack: "var(--font-playfair), Georgia, serif" },
  times: { label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
} as const;

export const CV_ACCENTS = {
  noir: { label: "Noir", value: "#000000" },
  bleu: { label: "Bleu", value: "#2563EB" },
  cyan: { label: "Cyan", value: "#06B6D4" },
  bordeaux: { label: "Bordeaux", value: "#9B1C1C" },
  vert: { label: "Vert", value: "#065F46" },
  violet: { label: "Violet", value: "#5B21B6" },
} as const;

export const CV_LAYOUTS = {
  une_colonne: "Une colonne",
  deux_colonnes: "Deux colonnes",
} as const;

export type CvFont = keyof typeof CV_FONTS;
export type CvAccent = keyof typeof CV_ACCENTS;
export type CvLayout = keyof typeof CV_LAYOUTS;

export const CV_FONT_SIZE_MIN = 10;
export const CV_FONT_SIZE_MAX = 16;
export const CV_FONT_SIZE_STEP = 0.5;

export type CvStyle = {
  font: CvFont;
  /** Taille choisie (px) ; l'ajustement automatique peut réduire en dessous pour tenir sur 1 page. */
  fontSize: number;
  accent: CvAccent;
  layout: CvLayout;
};

export const DEFAULT_CV_STYLE: CvStyle = {
  font: "georgia",
  fontSize: 11.5,
  accent: "noir",
  layout: "une_colonne",
};

/** Réglages par défaut de la lettre de motivation (une seule colonne, texte un peu plus grand). */
export const DEFAULT_LETTER_STYLE: CvStyle = {
  font: "inter",
  fontSize: 12,
  accent: "noir",
  layout: "une_colonne",
};

/** Lit un style enregistré (JSON) en ignorant toute valeur inconnue ou hors limites. */
export function readCvStyle(raw: unknown, defaults: CvStyle = DEFAULT_CV_STYLE): CvStyle {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof CvStyle, unknown>>;
  const size = Number(value.fontSize);
  const validSize =
    Number.isFinite(size) &&
    size >= CV_FONT_SIZE_MIN &&
    size <= CV_FONT_SIZE_MAX &&
    Number.isInteger(size / CV_FONT_SIZE_STEP);
  return {
    font: typeof value.font === "string" && value.font in CV_FONTS ? (value.font as CvFont) : defaults.font,
    fontSize: validSize ? size : defaults.fontSize,
    accent:
      typeof value.accent === "string" && value.accent in CV_ACCENTS
        ? (value.accent as CvAccent)
        : defaults.accent,
    layout:
      typeof value.layout === "string" && value.layout in CV_LAYOUTS
        ? (value.layout as CvLayout)
        : defaults.layout,
  };
}

/** Sections placées dans la colonne de gauche en mise en page « deux colonnes ». */
export const SIDE_COLUMN_SECTION =
  /comp[ée]tence|langue|skill|language|outil|logiciel|savoir|int[ée]r[êe]t|loisir|hobb|certif/i;
