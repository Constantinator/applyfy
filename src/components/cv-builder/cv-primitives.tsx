"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";

// Briques des modèles du CV Builder, rendues de deux façons à partir du même code :
// - en PDF par @react-pdf/renderer (téléchargement) ;
// - en HTML (aperçu de l'éditeur, textes modifiables directement).
// Les styles suivent la syntaxe de react-pdf (nombres en points, flexbox en colonne par
// défaut) ; le rendu HTML les convertit en CSS.

export type CvStyle = Record<string, string | number | undefined>;
export type StyleProp = CvStyle | (CvStyle | undefined | false)[] | undefined;

/**
 * Champ modifiable depuis l'aperçu : chemin dans les données du CV, ex. "personal.city",
 * "experiences.<id>.bullets.2" (élément de liste désigné par son id ou son index).
 */
export type EditPath = string;

type CommonProps = { style?: StyleProp; children?: ReactNode };
export type ViewProps = CommonProps & { fixed?: boolean; wrap?: boolean };
export type TextProps = CommonProps & {
  /** Champ modifié quand on édite ce texte dans l'aperçu (le texte est alors `children`). */
  edit?: EditPath;
  /** Texte sur plusieurs lignes (résumé, description). */
  multiline?: boolean;
  /** Indication affichée dans l'aperçu quand le champ est vide. */
  placeholder?: string;
};
export type LinkProps = TextProps & { src: string };
export type ImageProps = { src: string; style?: StyleProp };
export type PageProps = CommonProps;

export type CvPrimitives = {
  Page: (props: PageProps) => ReactNode;
  View: (props: ViewProps) => ReactNode;
  Text: (props: TextProps) => ReactNode;
  Link: (props: LinkProps) => ReactNode;
  Image: (props: ImageProps) => ReactNode;
};

export const PrimitivesContext = createContext<CvPrimitives | null>(null);

function usePrimitives() {
  const primitives = useContext(PrimitivesContext);
  if (!primitives) throw new Error("Modèle de CV rendu sans PrimitivesContext.");
  return primitives;
}

export function Page(props: PageProps) {
  return createElement(usePrimitives().Page, props);
}
export function View(props: ViewProps) {
  return createElement(usePrimitives().View, props);
}
export function Text(props: TextProps) {
  return createElement(usePrimitives().Text, props);
}
export function Link(props: LinkProps) {
  return createElement(usePrimitives().Link, props);
}
export function Photo(props: ImageProps) {
  return createElement(usePrimitives().Image, props);
}

/** Taille du texte (densityFactor) : 1 normale, < 1 plus petite, > 1 plus grande. */
export const DensityContext = createContext(1);
const DENSITY_KEYS = ["fontSize", "marginTop", "marginBottom", "marginVertical", "paddingTop", "paddingBottom", "paddingVertical"];

/** Style aplati, à la densité `k`. */
export function densityStyle(style: StyleProp, k: number): CvStyle {
  const s = flatten(style);
  if (k === 1) return s;
  const out: CvStyle = { ...s };
  for (const key of DENSITY_KEYS) {
    const value = s[key];
    if (typeof value === "number") out[key] = Math.round(value * k * 100) / 100;
  }
  return out;
}

/** Styles combinés : `[a, b && c]` → un seul objet, les suivants l'emportent. */
export function flatten(style: StyleProp): CvStyle {
  if (!style) return {};
  if (!Array.isArray(style)) return style;
  return Object.assign({}, ...style.filter(Boolean));
}
