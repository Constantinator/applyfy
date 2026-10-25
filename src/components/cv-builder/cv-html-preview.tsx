"use client";

import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { CV_FONTS, cvFontFile, type CvData, type CvTemplateId } from "@/lib/cv-builder-types";

import {
  COMPACT,
  DensityContext,
  densityStyle,
  PrimitivesContext,
  type CvPrimitives,
  type CvStyle,
  type EditPath,
  type StyleProp,
} from "./cv-primitives";
import { CvPages } from "./cv-templates";

// Aperçu de l'éditeur : les modèles rendus en HTML (mêmes styles et mêmes polices que le
// PDF), à l'échelle de la colonne. Les textes reliés à un champ se modifient au clic.

/** A4 en points, et en pixels CSS (1 pt = 4/3 px). */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PT_TO_PX = 4 / 3;
const A4_WIDTH_PX = A4_WIDTH_PT * PT_TO_PX;
const A4_HEIGHT_PX = A4_HEIGHT_PT * PT_TO_PX;

const UNITLESS = new Set(["lineHeight", "flex", "flexGrow", "flexShrink", "opacity", "zIndex", "fontWeight"]);
const BORDER_WIDTHS = ["borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"];
const fontStack = (id: string) => {
  const font = CV_FONTS.find((f) => f.id === id);
  return font ? `"cv-${font.id}", ${font.fallback}` : id;
};

/** Style des modèles (syntaxe react-pdf, en points) → CSS. */
function toCss(style: CvStyle): CSSProperties {
  const s: CvStyle = { ...style };
  const css: Record<string, string | number> = {};
  for (const [axis, a, b] of [
    ["paddingVertical", "paddingTop", "paddingBottom"],
    ["paddingHorizontal", "paddingLeft", "paddingRight"],
    ["marginVertical", "marginTop", "marginBottom"],
    ["marginHorizontal", "marginLeft", "marginRight"],
  ] as const) {
    if (s[axis] !== undefined) {
      s[a] ??= s[axis];
      s[b] ??= s[axis];
      delete s[axis];
    }
  }
  // Une bordure d'un seul côté en CSS : style plein, épaisseur nulle sur les autres côtés.
  if (BORDER_WIDTHS.some((k) => s[k] !== undefined)) {
    css.borderStyle = "solid";
    css.borderWidth = 0;
  }
  for (const [key, value] of Object.entries(s)) {
    if (value === undefined || key === "fontFeatureSettings") continue;
    if (key === "fontFamily") css.fontFamily = fontStack(String(value));
    else if (typeof value === "number" && !UNITLESS.has(key)) css[key] = `${value}pt`;
    else css[key] = value;
  }
  return css as CSSProperties;
}

const InTextContext = createContext(false);
const EditContext = createContext<((path: EditPath, value: string) => void) | null>(null);

/** Texte modifiable en place : le DOM n'est réécrit que si la valeur change d'ailleurs (curseur conservé). */
function EditableText({
  as,
  style,
  value,
  path,
  multiline,
  placeholder,
}: {
  as: "div" | "span";
  style: CSSProperties;
  value: string;
  path: EditPath;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const onEdit = useContext(EditContext);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);
  const props = {
    contentEditable: "plaintext-only" as const,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-label": placeholder ?? "Texte du CV",
    "aria-multiline": multiline || undefined,
    "data-placeholder": placeholder,
    spellCheck: true,
    className: "cv-editable",
    style,
    onInput: (e: React.FormEvent<HTMLElement>) => onEdit?.(path, e.currentTarget.textContent ?? ""),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
  };
  return as === "span" ? (
    <span ref={ref as React.RefObject<HTMLSpanElement>} {...props} />
  ) : (
    <div ref={ref as React.RefObject<HTMLDivElement>} {...props} />
  );
}

function HtmlText({ style, children, edit, multiline, placeholder }: Parameters<CvPrimitives["Text"]>[0]) {
  const nested = useContext(InTextContext);
  const onEdit = useContext(EditContext);
  const s = densityStyle(style, useContext(DensityContext));
  const css: CSSProperties = nested ? toCss(s) : { display: "block", ...toCss(s) };
  const as = nested ? "span" : "div";
  if (edit && onEdit && (typeof children === "string" || typeof children === "number" || children == null)) {
    return (
      <EditableText as={as} style={css} value={children == null ? "" : String(children)} path={edit} multiline={multiline} placeholder={placeholder} />
    );
  }
  return createElement(as, { style: css }, <InTextContext value>{children}</InTextContext>);
}

function useCss(style: StyleProp) {
  return toCss(densityStyle(style, useContext(DensityContext)));
}

const HTML_PRIMITIVES: CvPrimitives = {
  Page: function Page({ style, children }) {
    const css = useCss(style);
    return (
      <div
        className="cv-page"
        style={{
          position: "relative",
          boxSizing: "border-box",
          width: `${A4_WIDTH_PT}pt`,
          minHeight: `${A4_HEIGHT_PT}pt`,
          background: "white",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          ...css,
        }}
      >
        {children}
      </div>
    );
  },
  View: function View({ style, children }) {
    const css = useCss(style);
    return <div style={{ display: "flex", flexDirection: "column", position: "relative", minWidth: 0, ...css }}>{children}</div>;
  },
  Text: HtmlText,
  // Lien non cliquable dans l'aperçu : un clic sert à modifier le texte.
  Link: (props) => <HtmlText {...props} />,
  Image: function Image({ src, style }) {
    const css = useCss(style);
    // eslint-disable-next-line @next/next/no-img-element -- photo en data URL, rendue telle quelle
    return <img src={src} alt="" style={{ display: "block", ...css }} />;
  },
};

/** Polices du CV pour l'aperçu : mêmes fichiers que le PDF. */
const FONT_FACES = CV_FONTS.flatMap((font) =>
  ([400, 700] as const).map(
    (weight) =>
      `@font-face{font-family:"cv-${font.id}";font-weight:${weight};font-style:normal;font-display:swap;src:url(${cvFontFile(font.id, weight)}) format("truetype")}`,
  ),
).join("");

const EDITABLE_CSS = `
.cv-editable{outline:none;border-radius:2px;cursor:text;transition:background-color .15s,box-shadow .15s}
.cv-editable:hover{background-color:rgba(59,130,246,.10);box-shadow:0 0 0 1px rgba(59,130,246,.45)}
.cv-editable:focus{background-color:rgba(59,130,246,.14);box-shadow:0 0 0 1.5px #3b82f6}
.cv-editable:empty::before{content:attr(data-placeholder);color:#9ca3af}
`;

/**
 * Aperçu modifiable du CV, mis à l'échelle de la colonne. Les sauts de page sont estimés
 * (le PDF répète les marges du haut et du bas sur chaque page).
 */
export function CvHtmlPreview({
  data,
  templateId,
  onEdit,
  onPagesChange,
}: {
  data: CvData;
  templateId: CvTemplateId;
  onEdit: (path: EditPath, value: string) => void;
  onPagesChange?: (pages: number) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  const [height, setHeight] = useState(A4_HEIGHT_PX);
  const pagesChange = useRef(onPagesChange);
  useLayoutEffect(() => {
    pagesChange.current = onPagesChange;
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return;
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1.25, frame.clientWidth / A4_WIDTH_PX));
      const h = page.offsetHeight;
      setHeight(h);
      pagesChange.current?.(Math.max(1, Math.ceil((h - 2) / A4_HEIGHT_PX)));
    });
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil((height - 2) / A4_HEIGHT_PX));

  return (
    <div ref={frameRef} className="w-full">
      <style>{FONT_FACES + EDITABLE_CSS}</style>
      <div style={{ height: height * scale, width: A4_WIDTH_PX * scale }} className="relative mx-auto">
        <div
          ref={pageRef}
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A4_WIDTH_PX }}
          className="absolute top-0 left-0 shadow-sm ring-1 ring-slate-200"
        >
          <EditContext value={onEdit}>
            <PrimitivesContext value={HTML_PRIMITIVES}>
              <DensityContext value={data.style.density === "compact" ? COMPACT : 1}>
                <CvPages data={data} templateId={templateId} />
              </DensityContext>
            </PrimitivesContext>
          </EditContext>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-rose-400"
              style={{ top: (i + 1) * A4_HEIGHT_PX }}
            >
              <span className="absolute -top-6 right-2 rounded bg-rose-500 px-1.5 py-0.5 text-xs font-medium text-white">
                Fin de la page {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/** Polices du CV, à rendre une fois dans une page qui affiche des miniatures. */
export function CvFontFaces() {
  return <style>{FONT_FACES}</style>;
}

/** Miniature d'un modèle (première page, non modifiable), de largeur `width` en pixels. */
export function CvThumbnail({ data, templateId, width }: { data: CvData; templateId: CvTemplateId; width: number }) {
  const scale = width / A4_WIDTH_PX;
  return (
    <div aria-hidden="true" className="relative overflow-hidden bg-white" style={{ width, height: A4_HEIGHT_PX * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A4_WIDTH_PX, pointerEvents: "none" }}>
        <PrimitivesContext value={HTML_PRIMITIVES}>
          <CvPages data={data} templateId={templateId} />
        </PrimitivesContext>
      </div>
    </div>
  );
}
