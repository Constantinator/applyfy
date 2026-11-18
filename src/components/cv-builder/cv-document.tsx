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
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

import { CV_FONTS, cvFontFile, densityFactor, frenchNoBreak, fullName, normalizeSpaces, type CvData, type CvLang, type CvTemplateId } from "@/lib/cv-builder-types";
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

/**
 * Interligne du texte, comme dans un navigateur : un rapport (1,4) appliqué à la taille de CHAQUE texte.
 * react-pdf, lui, convertit le rapport en points là où il est déclaré (9,5 × 1,4 sur la page) puis hérite
 * de cette hauteur fixe : les titres étaient trop serrés et les petits textes trop espacés, et l'aperçu
 * n'avait pas la hauteur du PDF. Chaque texte reçoit donc son propre interligne, calculé sur sa taille.
 */
type Typography = { fontSize: number; lineHeight: number | undefined };
/** Taille par défaut de react-pdf (aucun modèle n'en dépend : la page fixe toujours la sienne). */
const TypographyContext = createContext<Typography>({ fontSize: 18, lineHeight: undefined });
/** Dans un texte : les passages imbriqués (gras, champ d'une ligne) suivent l'interligne du texte. */
const InTextContext = createContext(false);

/** Taille et rapport d'interligne en vigueur après `style` (déjà à la densité du CV). */
function useTypography(style: PdfStyle): Typography {
  const inherited = useContext(TypographyContext);
  const { fontSize, lineHeight } = style as { fontSize?: unknown; lineHeight?: unknown };
  return {
    fontSize: typeof fontSize === "number" ? fontSize : inherited.fontSize,
    lineHeight: typeof lineHeight === "number" ? lineHeight : inherited.lineHeight,
  };
}

/** Transmet la taille et l'interligne aux textes contenus, si `style` les change. */
function WithTypography({ style, children }: { style: PdfStyle; children: ReactNode }) {
  const inherited = useContext(TypographyContext);
  const typography = useTypography(style);
  if (typography.fontSize === inherited.fontSize && typography.lineHeight === inherited.lineHeight) return children;
  return <TypographyContext value={typography}>{children}</TypographyContext>;
}

/** Style d'un texte avec son propre interligne (texte de premier niveau seulement). */
function useTextStyle(style: StyleProp): PdfStyle {
  const s = usePdfStyle(style);
  const typography = useTypography(s);
  const nested = useContext(InTextContext);
  if (nested || typography.lineHeight === undefined) return s;
  // Taille et rapport dans le même style : react-pdf multiplie l'un par l'autre.
  return { ...s, fontSize: typography.fontSize, lineHeight: typography.lineHeight } as PdfStyle;
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

/** Langue du CV : typographie du texte rendu (espaces insécables en français). */
const LanguageContext = createContext<CvLang>("fr");

/**
 * Texte avec sa mise en forme (gras, italique, souligné), sans espace fine absente des polices, et sans
 * coupure avant « : » et « % » en français.
 */
function RichRuns({ text: raw }: { text: string }) {
  const language = useContext(LanguageContext);
  const text = normalizeSpaces(raw);
  const shown = frenchNoBreak(text, language);
  const runs = parseRich(shown);
  if (runs.length === 1 && !runs[0].format) return shown;
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

/**
 * Props de mise en page réellement définies. react-pdf teste la présence de la clé (`'wrap' in props`,
 * `'fixed' in props`), pas sa valeur : une prop transmise à undefined rend le bloc insécable et annule
 * ses règles de coupure de page.
 */
function defined<T extends Record<string, unknown>>(props: T): Partial<T> {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as Partial<T>;
}

const PDF_PRIMITIVES: CvPrimitives = {
  Page: function Page({ style, children }) {
    const s = usePdfStyle(style);
    // Sans ligatures (« fi » en un seul signe) : le texte extrait du PDF par les ATS reste exact.
    return (
      <PdfPage size="A4" style={{ ...s, fontFeatureSettings: NO_LIGATURES } as PdfStyle}>
        <WithTypography style={s}>{children}</WithTypography>
      </PdfPage>
    );
  },
  View: function View({ style, children, fixed, wrap, minPresenceAhead }) {
    const s = usePdfStyle(style);
    return (
      <PdfView style={s} {...defined({ fixed, wrap, minPresenceAhead })}>
        <WithTypography style={s}>{children}</WithTypography>
      </PdfView>
    );
  },
  Text: function Text({ style, children, display }) {
    return (
      <PdfText style={useTextStyle(style)}>
        <InTextContext value>{typeof children === "string" ? <RichRuns text={display ?? children} /> : children}</InTextContext>
      </PdfText>
    );
  },
  // Lien hors d'un texte (coordonnées du Sidebar) : react-pdf le rend comme un texte.
  Link: function Link({ src, style, children }) {
    return (
      <PdfLink src={src} style={useTextStyle(style)}>
        <InTextContext value>{children}</InTextContext>
      </PdfLink>
    );
  },
  Image: function Image({ src, style }) {
    return <PdfImage src={src} style={usePdfStyle(style)} />;
  },
};

/** Le CV complet en PDF. Appeler registerCvFonts avant le rendu. */
export function CvDocument({
  data,
  templateId,
  title,
  language = "fr",
}: {
  data: CvData;
  templateId: CvTemplateId;
  title: string;
  language?: CvLang;
}) {
  return (
    <Document title={title} author={fullName(data) || undefined} creator="Applyfy" producer="Applyfy" language={language}>
      <PrimitivesContext value={PDF_PRIMITIVES}>
        <DensityContext value={densityFactor(data.style.density)}>
          <LanguageContext value={language}>
            <CvPages data={data} templateId={templateId} language={language} />
          </LanguageContext>
        </DensityContext>
      </PrimitivesContext>
    </Document>
  );
}
