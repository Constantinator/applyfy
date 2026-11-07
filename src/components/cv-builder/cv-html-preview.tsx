"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  applyEdit,
  CV_FONTS,
  cvFontFile,
  densityFactor,
  enterAction,
  fieldLimit,
  fieldLimitMessage,
  fieldPlaceholder,
  hasLineMerge,
  keepsCaretOnBlank,
  readField,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { parseRich, type RichFormat } from "@/lib/cv-rich-text";

import {
  DensityContext,
  densityStyle,
  PrimitivesContext,
  type CvPrimitives,
  type CvStyle,
  type EditPath,
  type StyleProp,
} from "./cv-primitives";
import { CvPages } from "./cv-templates";
import { cutLine, useLineEditing } from "./use-line-editing";

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

/**
 * Champ en cours de saisie, gardé à l'écran même vide : les modèles masquent les textes vides (le
 * PDF aussi), et il reçoit donc ce caractère invisible à la place de son texte, le temps de la saisie.
 * Il n'existe que dans les données passées aux modèles de l'aperçu, jamais dans le CV.
 */
const SHOWN_EMPTY = "\u200b";
const withoutShownEmpty = (text: string) => text.split(SHOWN_EMPTY).join("");

/** Champ qui a le curseur. */
const ActiveLineContext = createContext<EditPath | null>(null);
const InTextContext = createContext(false);
const EditContext = createContext<((path: EditPath, value: string) => void) | null>(null);
/** Entrée dans une ligne de liste : texte avant et après le curseur. */
const LineBreakContext = createContext<((path: EditPath, before: string, after: string) => void) | null>(null);
/** Retour arrière au tout début d'une ligne de liste : true si la ligne a été recollée ou retirée. */
const LineMergeContext = createContext<((path: EditPath) => boolean) | null>(null);
/** Message à montrer quand une saisie est bloquée : limite de lignes ou de caractères. */
const LimitNoticeContext = createContext<((message: string) => void) | null>(null);
/** Textes surlignés après une modification du coach : l'aperçu seul le fournit, pas le PDF. */
const HighlightContext = createContext<{ paths: ReadonlySet<string>; fading: boolean } | null>(null);

function useHighlightClass(path: EditPath | undefined) {
  const highlight = useContext(HighlightContext);
  if (!path || !highlight?.paths.has(path)) return undefined;
  return highlight.fading ? "cv-highlight cv-highlight-fade" : "cv-highlight";
}

/** Mêmes textes, aux blancs près. */
const sameWords = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/** Curseur à la position `offset` du texte de `el`, quels que soient les nœuds qui le composent. */
function placeCaret(el: HTMLElement, offset: number) {
  const selection = window.getSelection();
  let left = offset;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (left <= node.data.length) {
      selection?.collapse(node, left);
      return;
    }
    left -= node.data.length;
  }
  selection?.selectAllChildren(el);
  selection?.collapseToEnd();
}

/** Texte de part et d'autre de la sélection (le texte sélectionné est remplacé). */
function textAroundSelection(el: HTMLElement): [string, string] {
  const text = el.textContent ?? "";
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [text, ""];
  const selected = selection.getRangeAt(0);
  const offset = (container: Node, position: number) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.setEnd(container, position);
    return range.toString().length;
  };
  return [text.slice(0, offset(selected.startContainer, selected.startOffset)), text.slice(offset(selected.endContainer, selected.endOffset))];
}

/** Texte modifiable en place : le DOM n'est réécrit que si la valeur change d'ailleurs (curseur conservé). */
function EditableText({
  as,
  style,
  value,
  path,
  multiline,
  placeholder,
  display,
  highlightClass,
}: {
  as: "div" | "span";
  style: CSSProperties;
  value: string;
  path: EditPath;
  multiline?: boolean;
  placeholder?: string;
  display?: string;
  highlightClass?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const onEdit = useContext(EditContext);
  const breakLine = useContext(LineBreakContext);
  const mergeWithPrevious = useContext(LineMergeContext);
  const activeLine = useContext(ActiveLineContext);
  const wasActive = useRef(activeLine === path);
  // Intitulé seul sur sa ligne à l'affichage : le texte enregistré garde son espace (« Intitulé : a »).
  const toStored = (text: string) => (display?.includes("\n") ? text.replace(":\n", ": ") : text);
  // Limite de caractères du champ (la même que la validation du CV) : la saisie s'y arrête, pour qu'un
  // seul champ trop long ne bloque jamais la sauvegarde ni le coach.
  const limit = fieldLimit(path);
  const showNotice = useContext(LimitNoticeContext);
  const limitNotice = useRef(() => {});
  useLayoutEffect(() => {
    limitNotice.current = () => showNotice?.(fieldLimitMessage(path));
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (!e.inputType.startsWith("insert") || e.isComposing) return;
      const inserted = e.data ?? e.dataTransfer?.getData("text/plain") ?? "\n";
      const selected = window.getSelection()?.toString().length ?? 0;
      if ((el.textContent?.length ?? 0) - selected + inserted.length <= limit) return;
      e.preventDefault();
      limitNotice.current();
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [limit]);
  // Hors saisie : texte mis en forme. Pendant la saisie : texte brut avec son marquage
  // (**gras**…), réécrit seulement si la valeur change d'ailleurs (curseur conservé).
  const [focused, setFocused] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused) {
      el.replaceChildren(...richNodes(display ?? value));
      return;
    }
    // Ligne activée après Entrée ou Retour arrière : le curseur reste à la position demandée.
    const caretOffset = el.dataset.caretOffset;
    delete el.dataset.caretOffset;
    // Seuls les blancs diffèrent (intitulé seul sur sa ligne à l'affichage) : le texte ne bouge pas sous
    // le clic, et le curseur reste où il a été posé.
    if (sameWords(el.textContent ?? "", value)) return;
    if (el.textContent !== value) {
      el.textContent = value;
      // Curseur en fin de texte (le texte affiché vient de changer).
      if (caretOffset !== undefined) placeCaret(el, Number(caretOffset));
      else {
        const selection = window.getSelection();
        selection?.selectAllChildren(el);
        selection?.collapseToEnd();
      }
    }
  }, [value, display, focused]);
  // Une ligne qui change de type pendant la frappe (« Langages : » devient un groupe) peut changer de
  // place et être recréée : le curseur la suit, en fin de texte (déjà écrit par l'effet ci-dessus),
  // pour ne perdre aucune frappe.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !wasActive.current || document.activeElement === el) return;
    el.focus();
    const selection = window.getSelection();
    selection?.selectAllChildren(el);
    selection?.collapseToEnd();
  }, []);
  const shownPlaceholder = placeholder ?? fieldPlaceholder(path);
  const props = {
    "data-edit-path": path,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    contentEditable: "plaintext-only" as const,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-label": shownPlaceholder,
    "aria-multiline": multiline || undefined,
    "data-placeholder": shownPlaceholder,
    spellCheck: true,
    className: highlightClass ? `cv-editable ${highlightClass}` : "cv-editable",
    style,
    onInput: (e: React.FormEvent<HTMLElement>) => {
      const text = toStored(e.currentTarget.textContent ?? "");
      // Saisie assistée ou correction du navigateur, qui ne peuvent pas être bloquées avant coup.
      // Un texte déjà trop long reste entier pendant qu'on le raccourcit.
      const grew = text.length > limit && text.length > value.length;
      if (grew) limitNotice.current();
      onEdit?.(path, grew ? text.slice(0, limit) : text);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      // Retour arrière au tout début d'une ligne de liste : geste inverse d'Entrée.
      if (e.key === "Backspace" && !e.nativeEvent.isComposing && hasLineMerge(path) && window.getSelection()?.isCollapsed) {
        const [textBefore] = textAroundSelection(e.currentTarget);
        if (textBefore === "" && mergeWithPrevious?.(path)) e.preventDefault();
        return;
      }
      // Validation d'un mot pendant une saisie assistée : ignorée.
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
      const action = enterAction(path);
      if (action === "newline") return; // paragraphe : saut de ligne du navigateur
      e.preventDefault();
      if (action === "validate") {
        e.currentTarget.blur();
        return;
      }
      if (action === "below") {
        breakLine?.(path, value, "");
        return;
      }
      // Ligne de liste : nouvelle ligne en dessous. Déjà sur une ligne vide : le curseur y reste, pour
      // qu'un double appui ne fasse pas sortir du champ (la frappe suivante serait perdue).
      if (!e.currentTarget.textContent?.trim() && keepsCaretOnBlank(path)) return;
      const [textBefore, textAfter] = textAroundSelection(e.currentTarget);
      const [before, after] = cutLine(path, toStored(textBefore), textAfter);
      breakLine?.(path, before, after);
    },
  };
  return as === "span" ? (
    <span ref={ref as React.RefObject<HTMLSpanElement>} {...props} />
  ) : (
    <div ref={ref as React.RefObject<HTMLDivElement>} {...props} />
  );
}

const RUN_CSS: Record<RichFormat, Partial<CSSStyleDeclaration>> = {
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  underline: { textDecoration: "underline" },
};

/** Nœuds DOM d'un texte mis en forme (texte modifiable, géré hors de React). */
function richNodes(text: string): Node[] {
  return parseRich(text).map((run) => {
    if (!run.format) return document.createTextNode(run.text);
    const span = document.createElement("span");
    Object.assign(span.style, RUN_CSS[run.format]);
    span.textContent = run.text;
    return span;
  });
}

/** Texte mis en forme (rendu React, textes non modifiables). */
function RichText({ text }: { text: string }) {
  const runs = parseRich(text);
  if (runs.length === 1 && !runs[0].format) return text;
  return runs.map((run, i) => (run.format ? <span key={i} style={RUN_CSS[run.format] as CSSProperties}>{run.text}</span> : run.text));
}

function HtmlText({ style, children, edit, multiline, placeholder, display }: Parameters<CvPrimitives["Text"]>[0]) {
  const nested = useContext(InTextContext);
  const onEdit = useContext(EditContext);
  const highlightClass = useHighlightClass(edit);
  const s = densityStyle(style, useContext(DensityContext));
  const css: CSSProperties = nested ? toCss(s) : { display: "block", ...toCss(s) };
  const as = nested ? "span" : "div";
  if (edit && onEdit && (typeof children === "string" || typeof children === "number" || children == null)) {
    return (
      <EditableText
        as={as}
        style={css}
        value={children == null ? "" : withoutShownEmpty(String(children))}
        path={edit}
        multiline={multiline}
        placeholder={placeholder}
        display={display}
        highlightClass={highlightClass}
      />
    );
  }
  return createElement(
    as,
    { style: css, className: highlightClass },
    <InTextContext value>{typeof children === "string" ? <RichText text={display ?? children} /> : children}</InTextContext>,
  );
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
  ([400, 700] as const).flatMap((weight) =>
    [false, true].map(
      (italic) =>
        `@font-face{font-family:"cv-${font.id}";font-weight:${weight};font-style:${italic ? "italic" : "normal"};font-display:swap;src:url(${cvFontFile(font.id, weight, italic)}) format("truetype")}`,
    ),
  ),
).join("");

const EDITABLE_CSS = `
.cv-editable{outline:none;border-radius:2px;cursor:text;transition:background-color .15s,box-shadow .15s}
.cv-editable:hover{background-color:rgba(59,130,246,.10);box-shadow:0 0 0 1px rgba(59,130,246,.45)}
.cv-editable:focus{background-color:rgba(59,130,246,.14);box-shadow:0 0 0 1.5px #3b82f6}
.cv-editable:empty::before{content:attr(data-placeholder);color:#9ca3af}
.cv-highlight{background-color:rgba(251,191,36,.35);border-radius:2px;transition:background-color 1s ease}
.cv-highlight-fade{background-color:transparent;transition:background-color 1.5s ease}
`;

/**
 * Aperçu modifiable du CV, mis à l'échelle de la colonne. Les sauts de page sont estimés
 * (le PDF répète les marges du haut et du bas sur chaque page).
 */
export function CvHtmlPreview({
  data,
  templateId,
  onEdit,
  onChange,
  onLineLimit,
  onPagesChange,
  highlights,
  highlightFading = false,
}: {
  data: CvData;
  templateId: CvTemplateId;
  onEdit: (path: EditPath, value: string) => void;
  /** Entrée ou Retour arrière dans une ligne de liste (cf. useLineEditing). */
  onChange: (fn: (d: CvData) => CvData) => void;
  /** Saisie bloquée : limite du champ, liste pleine ou texte recollé trop long. */
  onLineLimit: (message: string) => void;
  onPagesChange?: (pages: number) => void;
  /** Chemins des textes à surligner (cf. diffCvData). */
  highlights?: ReadonlySet<string>;
  /** Le surlignage s'efface progressivement. */
  highlightFading?: boolean;
}) {
  const highlight = useMemo(() => (highlights ? { paths: highlights, fading: highlightFading } : null), [highlights, highlightFading]);
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

  // Champ en cours de saisie, gardé à l'écran même vide (cf. SHOWN_EMPTY).
  const [activeLine, setActiveLine] = useState<EditPath | null>(null);
  const { breakLine, mergeWithPrevious } = useLineEditing({
    data,
    apply: onChange,
    notify: onLineLimit,
    onActivate: setActiveLine,
    focus: (path, offset) => {
      const target = pageRef.current?.querySelector<HTMLElement>(`[data-edit-path="${CSS.escape(path)}"]`);
      if (!target) return;
      target.dataset.caretOffset = String(offset);
      target.focus();
      placeCaret(target, offset);
    },
  });
  const shownData = useMemo(
    () => (activeLine && readField(data, activeLine)?.trim() === "" ? applyEdit(data, activeLine, SHOWN_EMPTY) : data),
    [data, activeLine],
  );

  return (
    <div ref={frameRef} className="w-full">
      <style>{FONT_FACES + EDITABLE_CSS}</style>
      <div style={{ height: height * scale, width: A4_WIDTH_PX * scale }} className="relative mx-auto">
        <div
          ref={pageRef}
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A4_WIDTH_PX }}
          className="absolute top-0 left-0 ring-1 ring-line"
          onFocusCapture={(e) => {
            setActiveLine((e.target as HTMLElement).dataset.editPath ?? null);
          }}
          onBlurCapture={() => setActiveLine(null)}
        >
          <EditContext value={onEdit}>
            <LineBreakContext value={breakLine}>
              <LineMergeContext value={mergeWithPrevious}>
                <LimitNoticeContext value={onLineLimit}>
                  <ActiveLineContext value={activeLine}>
                    <PrimitivesContext value={HTML_PRIMITIVES}>
                      <DensityContext value={densityFactor(data.style.density)}>
                        <HighlightContext value={highlight}>
                          <CvPages data={shownData} templateId={templateId} />
                        </HighlightContext>
                      </DensityContext>
                    </PrimitivesContext>
                  </ActiveLineContext>
                </LimitNoticeContext>
              </LineMergeContext>
            </LineBreakContext>
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
