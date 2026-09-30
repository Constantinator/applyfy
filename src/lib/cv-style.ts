// Personnalisation du CV amélioré (police, taille, couleur d'accent, mise en page).
// Partagé entre l'éditeur (client) et l'enregistrement (serveur).

export const CV_FONTS = {
  inter: { label: "Inter", stack: "var(--font-inter), Arial, Helvetica, sans-serif" },
  calibri: { label: "Calibri", stack: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  georgia: { label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  playfair: { label: "Playfair Display", stack: "var(--font-playfair), Georgia, serif" },
  times: { label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
} as const;

export const CV_ACCENTS = {
  noir: { label: "Noir", value: "#0F172A" },
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
  font: "inter",
  fontSize: 11.5,
  accent: "noir",
  layout: "une_colonne",
};

/** Lit un style enregistré (JSON) en ignorant toute valeur inconnue ou hors limites. */
export function readCvStyle(raw: unknown): CvStyle {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof CvStyle, unknown>>;
  const size = Number(value.fontSize);
  const validSize =
    Number.isFinite(size) &&
    size >= CV_FONT_SIZE_MIN &&
    size <= CV_FONT_SIZE_MAX &&
    Number.isInteger(size / CV_FONT_SIZE_STEP);
  return {
    font: typeof value.font === "string" && value.font in CV_FONTS ? (value.font as CvFont) : DEFAULT_CV_STYLE.font,
    fontSize: validSize ? size : DEFAULT_CV_STYLE.fontSize,
    accent:
      typeof value.accent === "string" && value.accent in CV_ACCENTS
        ? (value.accent as CvAccent)
        : DEFAULT_CV_STYLE.accent,
    layout:
      typeof value.layout === "string" && value.layout in CV_LAYOUTS
        ? (value.layout as CvLayout)
        : DEFAULT_CV_STYLE.layout,
  };
}

/** Sections placées dans la colonne de gauche en mise en page « deux colonnes ». */
export const SIDE_COLUMN_SECTION =
  /comp[ée]tence|langue|skill|language|outil|logiciel|savoir|int[ée]r[êe]t|loisir|hobb|certif/i;
