"use client";

import {
  Document,
  Font,
  Image as PdfImage,
  Link as PdfLink,
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
} from "@react-pdf/renderer";
import { useContext, type ComponentProps } from "react";

import { CV_FONTS, cvFontFile, densityFactor, fullName, type CvData, type CvTemplateId } from "@/lib/cv-builder-types";
import { parseRich } from "@/lib/cv-rich-text";

import { DensityContext, densityStyle, PrimitivesContext, type CvPrimitives, type StyleProp } from "./cv-primitives";
import { CvPages } from "./cv-templates";

// Rendu PDF (A4) des modèles du CV Builder, par @react-pdf/renderer : téléchargement.
// Texte sélectionnable, lisible par les ATS ; polices intégrées au fichier.

type PdfStyle = NonNullable<ComponentProps<typeof PdfView>["style"]>;
/** Style react-pdf, à la densité du CV. */
function usePdfStyle(style: StyleProp) {
  return densityStyle(style, useContext(DensityContext)) as PdfStyle;
}

let fontsBase: string | null = null;

/**
 * Polices du CV (mêmes fichiers que l'aperçu). `base` : origine du site dans le navigateur,
 * ou dossier public/ en local (tests).
 */
export function registerCvFonts(base: string) {
  if (fontsBase === base) return;
  fontsBase = base;
  for (const font of CV_FONTS) {
    Font.register({
      family: font.id,
      fonts: [
        { src: `${base}${cvFontFile(font.id, 400)}`, fontWeight: 400 },
        { src: `${base}${cvFontFile(font.id, 700)}`, fontWeight: 700 },
        { src: `${base}${cvFontFile(font.id, 400, true)}`, fontWeight: 400, fontStyle: "italic" },
        { src: `${base}${cvFontFile(font.id, 700, true)}`, fontWeight: 700, fontStyle: "italic" },
      ],
    });
  }
  // Pas de césure automatique (règles anglaises par défaut : « dévelop-pement »).
  Font.registerHyphenationCallback((word) => [word]);
}

const RUN_STYLES = {
  bold: { fontWeight: 700 },
  italic: { fontStyle: "italic" },
  underline: { textDecoration: "underline" },
} as const;

/** Texte avec sa mise en forme (gras, italique, souligné). */
function RichRuns({ text }: { text: string }) {
  const runs = parseRich(text);
  if (runs.length === 1 && !runs[0].format) return text;
  return runs.map((run, i) =>
    run.format ? (
      <PdfText key={i} style={RUN_STYLES[run.format]}>
        {run.text}
      </PdfText>
    ) : (
      run.text
    ),
  );
}

const NO_LIGATURES = { liga: false, clig: false, dlig: false };

const PDF_PRIMITIVES: CvPrimitives = {
  Page: function Page({ style, children }) {
    const s = usePdfStyle(style);
    // Sans ligatures (« fi » en un seul signe) : le texte extrait du PDF par les ATS reste exact.
    return (
      <PdfPage size="A4" style={{ ...s, fontFeatureSettings: NO_LIGATURES } as PdfStyle}>
        {children}
      </PdfPage>
    );
  },
  View: function View({ style, children, fixed, wrap }) {
    return (
      <PdfView style={usePdfStyle(style)} fixed={fixed} wrap={wrap}>
        {children}
      </PdfView>
    );
  },
  Text: function Text({ style, children }) {
    return <PdfText style={usePdfStyle(style)}>{typeof children === "string" ? <RichRuns text={children} /> : children}</PdfText>;
  },
  Link: function Link({ src, style, children }) {
    return (
      <PdfLink src={src} style={usePdfStyle(style)}>
        {children}
      </PdfLink>
    );
  },
  Image: function Image({ src, style }) {
    return <PdfImage src={src} style={usePdfStyle(style)} />;
  },
};

/** Le CV complet en PDF. Appeler registerCvFonts avant le rendu. */
export function CvDocument({ data, templateId, title }: { data: CvData; templateId: CvTemplateId; title: string }) {
  return (
    <Document title={title} author={fullName(data) || undefined} creator="Applyfy" producer="Applyfy" language="fr">
      <PrimitivesContext value={PDF_PRIMITIVES}>
        <DensityContext value={densityFactor(data.style.density)}>
          <CvPages data={data} templateId={templateId} />
        </DensityContext>
      </PrimitivesContext>
    </Document>
  );
}
