"use client";

import { type ReactNode } from "react";

import { type cvSettings } from "@/lib/cv-builder-types";

import { DensityContext, Page, Text, View, type StyleProp } from "./cv-primitives";
import { Contact, contactLines, contrast, readableOn, urlLines, type ContactItem } from "./cv-templates";

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
export function ModelPage({ settings, lineHeight, children }: { settings: ModelSettings; lineHeight: number; children: ReactNode }) {
  return (
    <DensityContext value={1}>
      <Page
        style={{
          fontFamily: settings.font,
          fontSize: settings.body,
          lineHeight,
          color: INK,
          paddingVertical: settings.vertical,
          paddingHorizontal: settings.horizontal,
        }}
      >
        <DensityContext value={settings.factor}>{children}</DensityContext>
      </Page>
    </DensityContext>
  );
}

/**
 * Coordonnées de l'en-tête, séparées par « · » qui n'est jamais en début ni en fin de ligne (cf.
 * contactLines). `width` : largeur disponible (points) ; `size` : taille du texte au corps par défaut.
 * Une adresse e-mail ou une URL plus large que la ligne est coupée après « / », « . » ou « - », sans
 * tiret ajouté : elle ne déborde jamais. Le lien, lui, reste entier.
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
  const maxChars = Math.max(8, Math.floor(width / charWidth));
  const lines = contactLines(items, width, margin * 2 + size * settings.factor * 0.3, charWidth);
  const text = [...(Array.isArray(style) ? style : [style]), { fontSize: size }, center && { textAlign: "center" }];
  return (
    <View style={{ marginTop: top }}>
      {lines.map((line) => (
        <View key={line[0].field} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: center ? "center" : "flex-start" }}>
          {line.map((c, i) => (
            <View key={c.field} style={{ flexDirection: "row" }}>
              {i > 0 && <Text style={[...text, { marginHorizontal: margin }]}>·</Text>}
              <Contact item={c} style={text} display={c.href && c.label.length > maxChars ? urlLines(c.label, maxChars).join("\n") : undefined} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
