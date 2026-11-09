// Couleurs par fonction (tuiles d'icônes du Tableau de bord). Les valeurs sont les variables CSS
// --color-tint-* de globals.css ; les composants n'utilisent que ces classes, jamais d'hexadécimal.
// Les classes sont écrites en entier pour que Tailwind les détecte. Les pastilles de secteur sont
// à part (sector-tints.ts) : le Tableau de bord ne les importe jamais.

export type FunctionTint = "cv" | "letter" | "offer" | "interview" | "success";

/** Fond pâle et icône foncée, par fonction. */
export const FUNCTION_TINTS: Record<FunctionTint, string> = {
  cv: "bg-tint-cv text-tint-cv-ink dark:bg-slate-800 dark:text-blue-300",
  letter: "bg-tint-letter text-tint-letter-ink dark:bg-slate-800 dark:text-violet-300",
  offer: "bg-tint-offer text-tint-offer-ink dark:bg-slate-800 dark:text-amber-200",
  interview: "bg-tint-interview text-tint-interview-ink dark:bg-slate-800 dark:text-rose-300",
  success: "bg-tint-success text-tint-success-ink dark:bg-slate-800 dark:text-emerald-300",
};

/** Petite pastille de réussite (« Objectif tenu », « Prêt à envoyer »). */
export const SUCCESS_PILL = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${FUNCTION_TINTS.success}`;
