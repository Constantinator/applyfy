"use client";

import { useContext, type ReactNode } from "react";

import { type cvSettings, type CvSettingFont } from "@/lib/cv-builder-types";
import { CV_FONT_WIDTHS } from "@/lib/cv-font-widths";

import { DensityContext, Page, Text, View, type StyleProp } from "./cv-primitives";
import { Contact, contactLines, contrast, readableOn, TitlesContext, type ContactItem } from "./cv-templates";

// Socle des modèles réglables (police, taille du texte, marges : cvSettings) : la page et les coordonnées
// de l'en-tête. Les sections, les puces et les règles de coupure de page sont celles de cv-templates.

export type ModelSettings = ReturnType<typeof cvSettings>;

/** Couleur du texte courant, et du texte secondaire. */
export const INK = "#111827";
export const MUTED = "#4B5563";

/**
 * Couleurs d'un bandeau à la couleur d'accent, pour un contraste d'au moins 4,5:1 entre le texte et le
 * fond : texte blanc si l'accent est assez foncé, texte sombre s'il est assez clair ; entre les deux
 * (aucun des deux textes n'est lisible), l'accent est foncé juste assez pour porter un texte blanc.
 */
export function bandColors(accent: string): { background: string; text: string } {
  if (contrast("#FFFFFF", accent) >= 4.5) return { background: accent, text: "#FFFFFF" };
  if (contrast(INK, accent) >= 4.5) return { background: accent, text: INK };
  return { background: readableOn(accent, "#FFFFFF"), text: "#FFFFFF" };
}

/**
 * Page d'un modèle réglable. Le corps du texte et les marges sont ceux des réglages, en points exacts ;
 * les autres tailles et les espacements verticaux écrits par le modèle (pour son corps par défaut)
 * suivent à l'échelle, par le même mécanisme que la densité : une seule règle pour l'aperçu et le PDF.
 */
export function ModelPage({
  settings,
  lineHeight,
  bleed = false,
  children,
}: {
  settings: ModelSettings;
  lineHeight: number;
  /** Page sans marge sur les côtés : le modèle place lui-même ses colonnes (fond jusqu'au bord). */
  bleed?: boolean;
  children: ReactNode;
}) {
  return (
    <DensityContext value={1}>
      <Page
        style={{
          fontFamily: settings.font,
          fontSize: settings.body,
          lineHeight,
          color: INK,
          paddingVertical: settings.vertical,
          paddingHorizontal: bleed ? 0 : settings.horizontal,
        }}
      >
        <DensityContext value={settings.factor}>{children}</DensityContext>
      </Page>
    </DensityContext>
  );
}

/** Caractères après lesquels une adresse e-mail ou une URL peut passer à la ligne (sans tiret ajouté). */
const BREAK_AFTER = "/.-_";

/** Chasse d'un caractère (cadratins) dans une police des réglages ; hors de la table (non ASCII) : valeur large. */
function charWidth(font: CvSettingFont, char: string) {
  const code = char.charCodeAt(0);
  return (code >= 32 && code <= 126 ? CV_FONT_WIDTHS[font][code - 32] : 750) / 1000;
}

/** Largeur d'un texte (cadratins) dans une police des réglages, d'après les chasses réelles de la police. */
export function textWidth(font: CvSettingFont, text: string) {
  let width = 0;
  for (const char of text) width += charWidth(font, char);
  return width;
}

/**
 * Adresse e-mail ou URL affichée sur plusieurs lignes si elle est plus large que `maxWidth` (cadratins).
 * Coupée à un endroit naturel, le plus tard possible : avant « @ », ou après « / », « . », « - » ou
 * « _ » ; jamais dans un mot. Seul un morceau sans aucun de ces repères et plus large que la ligne est
 * coupé à la largeur, pour ne pas déborder. Affichage seulement : le texte enregistré et le lien restent
 * entiers.
 */
export function wrapContact(label: string, font: CvSettingFont, maxWidth: number): string[] {
  const lines: string[] = [];
  let rest = label;
  while (textWidth(font, rest) > maxWidth && rest.length > 1) {
    // Nombre de caractères qui tiennent sur la ligne (au moins un).
    let fit = 0;
    let width = 0;
    while (fit < rest.length && width + charWidth(font, rest[fit]) <= maxWidth) width += charWidth(font, rest[fit++]);
    fit = Math.max(1, fit);
    let cut = -1;
    for (let i = Math.min(fit, rest.length - 1); i > 0; i--) {
      if (rest[i] === "@" || BREAK_AFTER.includes(rest[i - 1])) {
        cut = i;
        break;
      }
    }
    if (cut === -1) cut = fit;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  lines.push(rest);
  return lines;
}

/**
 * Forme affichée d'une adresse e-mail ou d'une URL plus large que `width` points au corps `size` (taille
 * au corps par défaut du modèle) ; undefined si elle tient sur la ligne. 2 % de marge : crénage, arrondis.
 */
export function contactDisplay(item: ContactItem, settings: ModelSettings, width: number, size: number) {
  if (!item.href) return undefined;
  const maxWidth = (width / (size * settings.factor)) * 0.98;
  return textWidth(settings.font, item.label) > maxWidth ? wrapContact(item.label, settings.font, maxWidth).join("\n") : undefined;
}

/**
 * Dates d'une entrée, dans une colonne étroite à gauche : « 09/2020 – » puis « 02/2023 », ou « Mars 2023 – »
 * puis « Aujourd'hui ». L'espace avant le tiret est insécable : jamais de tiret seul en début de ligne.
 * Le texte ne se coupe qu'aux espaces (aucune césure : cf. registerCvFonts), jamais dans un mois.
 */
export function ColumnDates({ base, start, end, current, style }: { base: string; start: string; end?: string; current?: boolean; style?: StyleProp }) {
  const t = useContext(TitlesContext);
  const hasEnd = current || !!end?.trim();
  if (!start.trim() && !hasEnd) return null;
  return (
    <Text style={style}>
      {start.trim() ? <Text edit={`${base}.startDate`}>{start}</Text> : null}
      {start.trim() && hasEnd ? "\u00A0– " : null}
      {current ? t.present : end?.trim() ? <Text edit={`${base}.endDate`}>{end}</Text> : null}
    </Text>
  );
}

/** Ligne à deux colonnes : `side` (dates) dans une colonne de `width` points à gauche, le contenu à droite. */
export function DatedRow({ width, side, children }: { width: number; side: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width, paddingRight: 8 }}>{side}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * Coordonnées de l'en-tête, séparées par « · » qui n'est jamais en début ni en fin de ligne (cf.
 * contactLines). `width` : largeur disponible (points) ; `size` : taille du texte au corps par défaut.
 * Une adresse e-mail ou une URL plus large que la ligne est coupée à un endroit naturel (wrapContact),
 * sans tiret ajouté : elle ne déborde jamais. Le lien, lui, reste entier.
 */
export function ModelContacts({
  items,
  settings,
  width,
  size,
  center = false,
  top,
  margin = 5,
  style,
}: {
  items: ContactItem[];
  settings: ModelSettings;
  width: number;
  size: number;
  center?: boolean;
  top: number;
  margin?: number;
  style?: StyleProp;
}) {
  const charWidth = size * settings.factor * settings.charWidth;
  const lines = contactLines(items, width, margin * 2 + size * settings.factor * 0.3, charWidth);
  const text = [...(Array.isArray(style) ? style : [style]), { fontSize: size }, center && { textAlign: "center" }];
  return (
    <View style={{ marginTop: top }}>
      {lines.map((line) => (
        <View key={line[0].field} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start" }}>
          {line.map((c, i) => (
            <View key={c.field} style={{ flexDirection: "row" }}>
              {i > 0 && <Text style={[...text, { marginHorizontal: margin }]}>·</Text>}
              <Contact item={c} style={text} display={contactDisplay(c, settings, width, size)} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
