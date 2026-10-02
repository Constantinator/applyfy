"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { saveCoverLetterAction } from "@/app/actions/cover-letter";
import { saveImprovedCvAction } from "@/app/actions/cv";
import type { AiUsageCount } from "@/lib/ai-usage-limits";
import { applyLayout, toOneColumn } from "@/lib/cv-layout";
import {
  CV_LIST_TYPES,
  applyListType,
  closestList,
  listTypeOf,
  type CvListState,
  type CvListType,
} from "@/lib/cv-lists";
import {
  CV_ACCENTS,
  CV_FONTS,
  CV_FONT_SIZE_MAX,
  CV_FONT_SIZE_MIN,
  CV_FONT_SIZE_STEP,
  CV_LAYOUTS,
  DEFAULT_CV_STYLE,
  DEFAULT_LETTER_STYLE,
  type CvAccent,
  type CvLayout,
  type CvStyle,
} from "@/lib/cv-style";

import { CvRefineChat } from "./cv-refine-chat";
import { FontCombobox } from "./font-combobox";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

// Géométrie identique à l'écran et à l'impression : page A4 (@page margin 0 dans
// globals.css) avec une marge intérieure (16 mm pour le CV, 20 mm pour la lettre) →
// ce qui tient à l'écran tient au PDF.
const PAGE_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
/** Petite marge de sécurité (écarts de rendu entre écran et impression). */
const FIT_SAFETY_PX = 6;
/** Pas de réduction automatique de la police pour tenir sur 1 page. */
const FIT_STEP_PX = 0.25;

const px = (value: number) => `${value.toLocaleString("fr-FR")} px`;

// Mise en forme du CV, format épuré « à l'américaine » (HTML sans classes : balises
// stylées par le conteneur, cf. improvedCvToHtml). Tailles en em : tout le CV suit la
// taille de police. Noir uniquement (couleur d'accent au choix pour le nom et les titres
// de section, via --cv-accent). Vrais titres : structure lisible par les ATS.
const documentStyles = [
  "text-black leading-[1.45]",
  // Nom, centré, grand et gras
  "[&_h1]:text-center [&_h1]:text-[2.2em] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:text-[var(--cv-accent)]",
  // Coordonnées sur une ligne, centrées (CV d'avant ce format : titre puis coordonnées)
  "[&_h1+p]:mt-[0.35em] [&_h1+p]:text-center [&_h1+p]:text-[0.95em]",
  "[&_h1+p+p]:text-center [&_h1+p+p]:text-[0.95em]",
  // Sections : titre en majuscules, ligne fine en dessous, espace généreux
  "[&_h2]:mt-[1.5em] [&_h2]:mb-[0.6em] [&_h2]:border-b [&_h2]:border-[var(--cv-accent)] [&_h2]:pb-[0.15em] [&_h2]:text-[1.05em] [&_h2]:font-bold [&_h2]:tracking-[0.1em] [&_h2]:text-[var(--cv-accent)] [&_h2]:uppercase",
  // Entrée : intitulé en gras, dates alignées à droite sur la même ligne
  "[&_h3]:mt-[0.85em] [&_h3]:text-[1em] [&_h3]:font-bold",
  "[&_h3:has(>span)]:flex [&_h3:has(>span)]:items-baseline [&_h3:has(>span)]:justify-between [&_h3:has(>span)]:gap-x-[1.5em]",
  "[&_h3>span+span]:shrink-0 [&_h3>span+span]:font-normal [&_h3>span+span]:whitespace-nowrap",
  // Structure et lieu, en italique sous l'intitulé
  "[&_em]:italic",
  // Contenu
  "[&_p]:my-[0.15em] [&_ul]:mt-[0.3em] [&_ul]:mb-[0.2em] [&_ul]:list-disc [&_ul]:pl-[1.3em] [&_ol]:list-decimal [&_ol]:pl-[1.3em] [&_li]:my-[0.2em] [&_li]:pl-[0.15em]",
  "[&_strong]:font-bold",
].join(" ");

// Lettre de motivation (cf. lib/cover-letter) : <h1> nom, <p> coordonnées, destinataire et
// date, <h2> objet, puis paragraphes aérés.
const letterStyles = [
  "text-slate-800 leading-[1.4]",
  "[&_h1]:text-[1.7em] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--cv-accent)]",
  "[&_h1+p]:!mt-[0.2em] [&_h1+p]:text-[0.95em] [&_h1+p]:text-slate-600",
  "[&_h2]:mt-[1.6em] [&_h2]:mb-[1.2em] [&_h2]:text-[1em] [&_h2]:font-semibold [&_h2]:text-[var(--cv-accent)]",
  "[&_h3]:mt-[0.8em] [&_h3]:font-semibold",
  "[&_p]:my-[0.8em] [&_p]:text-justify [&_p]:hyphens-auto",
  "[&_ul]:my-[0.5em] [&_ul]:list-disc [&_ul]:pl-[1.3em] [&_ol]:list-decimal [&_ol]:pl-[1.3em] [&_li]:my-[0.15em]",
  "[&_strong]:font-semibold",
].join(" ");

// Deux colonnes : en-tête pleine largeur, puis <div> gauche (compétences, langues…) et
// <div> droite (profil, expériences, formation), cf. lib/cv-layout.
const twoColumnStyles = [
  "grid grid-cols-[34%_minmax(0,1fr)] content-start gap-x-[7mm]",
  "[&>*]:col-span-2 [&>div]:col-span-1 [&>div]:min-w-0",
  "[&>div:last-child]:border-l [&>div:last-child]:border-slate-200 [&>div:last-child]:pl-[6mm]",
].join(" ");

type ToolbarCommand = "bold" | "italic" | "underline";

const TOOLBAR_BUTTONS: { command: ToolbarCommand; title: string; label: React.ReactNode }[] = [
  { command: "bold", title: "Gras", label: <strong>G</strong> },
  { command: "italic", title: "Italique", label: <em className="font-serif">I</em> },
  { command: "underline", title: "Souligné", label: <span className="underline underline-offset-2">S</span> },
];

const NO_ACTIVE_FORMATS: Record<ToolbarCommand, boolean> = {
  bold: false,
  italic: false,
  underline: false,
};

/** Valeur du menu « Type de liste » quand la sélection n'est pas dans une liste. */
const NO_LIST = "aucune";

/** Documents modifiables avec cet éditeur : même interface, réglages propres à chacun. */
const EDITOR_KINDS = {
  cv: {
    save: saveImprovedCvAction,
    defaultStyle: DEFAULT_CV_STYLE,
    documentClassName: documentStyles,
    // Marges larges : CV aéré.
    paddingMm: 16,
    hasLayouts: true,
    label: "CV amélioré, modifiable",
    inDocument: "dans le CV",
    marksToggle: "Surligner les améliorations",
    marksHint: "passage ajouté ou reformulé par l'assistant",
    accentHint: "nom et titres de section",
  },
  lettre: {
    save: saveCoverLetterAction,
    defaultStyle: DEFAULT_LETTER_STYLE,
    documentClassName: letterStyles,
    // Marges plus larges, d'usage pour un courrier.
    paddingMm: 20,
    hasLayouts: false,
    label: "Lettre de motivation, modifiable",
    inDocument: "dans la lettre",
    marksToggle: "Surligner la personnalisation",
    marksHint: "passage personnalisé pour cette offre : vérifie qu'il est exact",
    accentHint: "nom et objet",
  },
} as const;

export type EditorKind = keyof typeof EDITOR_KINDS;

/** Panneau de mise en forme : police, taille, gras/italique/liste, couleur, mise en page. */
function StylePanel({
  kind,
  style,
  appliedSize,
  onChange,
  activeFormats,
  onFormat,
  listType,
  onListType,
}: {
  kind: EditorKind;
  style: CvStyle;
  appliedSize: number;
  onChange: (patch: Partial<CvStyle>) => void;
  activeFormats: Record<ToolbarCommand, boolean>;
  onFormat: (command: ToolbarCommand) => void;
  listType: CvListState;
  onListType: (type: CvListState) => void;
}) {
  const sectionTitle = "text-xs font-semibold tracking-wide text-slate-500 uppercase";
  const config = EDITOR_KINDS[kind];
  return (
    <aside aria-label="Mise en forme du document" className="card space-y-6 p-5 print:hidden">
      <h2 className="font-semibold text-slate-900">Mise en forme</h2>

      <div className="space-y-2">
        <label htmlFor="cv-font" className={`block ${sectionTitle}`}>
          Police
        </label>
        <FontCombobox id="cv-font" value={style.font} onChange={(font) => onChange({ font })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="cv-size" className={sectionTitle}>
            Taille
          </label>
          <output htmlFor="cv-size" className="text-sm font-semibold text-slate-900 tabular-nums">
            {px(style.fontSize)}
          </output>
        </div>
        <input
          id="cv-size"
          type="range"
          min={CV_FONT_SIZE_MIN}
          max={CV_FONT_SIZE_MAX}
          step={CV_FONT_SIZE_STEP}
          value={style.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>{px(CV_FONT_SIZE_MIN)}</span>
          <span>{px(CV_FONT_SIZE_MAX)}</span>
        </div>
        {appliedSize < style.fontSize && (
          <p className="text-xs text-amber-700">
            Réduite à {px(appliedSize)} pour tenir sur 1 page.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className={sectionTitle}>Mise en forme</p>
        <div role="toolbar" aria-label="Mise en forme du texte" className="grid grid-cols-3 gap-2">
          {TOOLBAR_BUTTONS.map(({ command, title, label }) => {
            const active = activeFormats[command];
            return (
              <button
                key={command}
                type="button"
                // mousedown sans preventDefault ferait perdre la sélection du texte dans le CV.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onFormat(command)}
                aria-pressed={active}
                aria-label={title}
                title={title}
                className={`h-9 rounded-md border text-sm font-medium transition ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label htmlFor="cv-list-type" className="block pt-1 text-xs font-medium text-slate-600">
          Type de liste
        </label>
        <select
          id="cv-list-type"
          value={listType ?? NO_LIST}
          onChange={(e) => onListType(e.target.value === NO_LIST ? null : (e.target.value as CvListType))}
          className="input py-2 text-sm"
        >
          {(Object.keys(CV_LIST_TYPES) as CvListType[]).map((type) => (
            <option key={type} value={type}>
              {CV_LIST_TYPES[type]}
            </option>
          ))}
          <option value={NO_LIST}>Sans liste</option>
        </select>
        <p className="text-xs text-slate-500">S&apos;applique au texte sélectionné {config.inDocument}.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className={sectionTitle}>Couleur d&apos;accent</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(CV_ACCENTS) as CvAccent[]).map((accent) => {
            const selected = style.accent === accent;
            return (
              <button
                key={accent}
                type="button"
                onClick={() => onChange({ accent })}
                aria-pressed={selected}
                aria-label={CV_ACCENTS[accent].label}
                title={CV_ACCENTS[accent].label}
                className={`h-8 w-8 rounded-full ring-offset-2 transition ${
                  selected ? "ring-2 ring-slate-900" : "ring-1 ring-slate-200 hover:ring-slate-400"
                }`}
                style={{ backgroundColor: CV_ACCENTS[accent].value }}
              />
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          {CV_ACCENTS[style.accent].label} · {config.accentHint}
        </p>
      </fieldset>

      {config.hasLayouts && (
      <fieldset className="space-y-2">
        <legend className={sectionTitle}>Mise en page</legend>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {(Object.keys(CV_LAYOUTS) as CvLayout[]).map((layout) => {
            const selected = style.layout === layout;
            return (
              <button
                key={layout}
                type="button"
                onClick={() => onChange({ layout })}
                aria-pressed={selected}
                className={`rounded-xl border p-2.5 text-left text-xs font-medium transition ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/15"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {/* Mini aperçu de la mise en page */}
                <span aria-hidden="true" className="mb-2 block rounded-md border border-slate-200 bg-white p-1.5">
                  <span className="mb-1 block h-1.5 w-1/2 rounded bg-slate-300" />
                  {layout === "une_colonne" ? (
                    <span className="block space-y-0.5">
                      <span className="block h-1 rounded bg-slate-200" />
                      <span className="block h-1 rounded bg-slate-200" />
                      <span className="block h-1 w-3/4 rounded bg-slate-200" />
                    </span>
                  ) : (
                    <span className="flex gap-1">
                      <span className="block w-1/3 space-y-0.5">
                        <span className="block h-1 rounded bg-slate-200" />
                        <span className="block h-1 rounded bg-slate-200" />
                      </span>
                      <span className="block flex-1 space-y-0.5">
                        <span className="block h-1 rounded bg-slate-200" />
                        <span className="block h-1 rounded bg-slate-200" />
                        <span className="block h-1 w-3/4 rounded bg-slate-200" />
                      </span>
                    </span>
                  )}
                </span>
                {CV_LAYOUTS[layout]}
              </button>
            );
          })}
        </div>
        {style.layout === "deux_colonnes" && (
          <p className="text-xs text-slate-500">
            À gauche : compétences, langues, outils… À droite : profil, expériences, formation.
          </p>
        )}
      </fieldset>
      )}

      <button
        type="button"
        onClick={() => onChange(config.defaultStyle)}
        className="btn-secondary w-full px-3 py-2 text-sm"
      >
        Réinitialiser
      </button>
    </aside>
  );
}

/**
 * Éditeur d'un document d'une page A4 (CV amélioré ou lettre de motivation) : texte
 * modifiable, panneau de mise en forme, enregistrement et export PDF.
 */
export function CvEditor({
  kind = "cv",
  applicationId,
  initialHtml,
  initialStyle,
  savedAt: initialSavedAt,
  pdfTitle,
  refine,
}: {
  kind?: EditorKind;
  applicationId: string;
  initialHtml: string;
  initialStyle: CvStyle;
  savedAt: string | null;
  /** Titre du document pendant l'impression = nom de fichier proposé pour le PDF. */
  pdfTitle: string;
  /** Chat « Affiner avec l'IA » sous le document (CV uniquement). */
  refine?: { aiEnabled: boolean; usage: AiUsageCount };
}) {
  const config = EDITOR_KINDS[kind];
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [error, setError] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(true);
  const [style, setStyle] = useState<CvStyle>(initialStyle);
  /** Taille réellement appliquée (≤ taille choisie, réduite si le CV dépasse 1 page). */
  const [fontPx, setFontPx] = useState(initialStyle.fontSize);
  /** Hauteur du contenu en nombre de pages A4 (≤ 1 : tient sur une page). */
  const [pages, setPages] = useState(1);

  // Ajuste la police pour tenir sur une page A4 : part de la taille choisie et réduit
  // jusqu'à 10 px si nécessaire.
  const fitToPage = useCallback((chosenSize: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pageHeightPx = PAGE_HEIGHT_MM * PX_PER_MM;
    const limit = pageHeightPx - FIT_SAFETY_PX;
    // Mesure la hauteur réelle du contenu : la hauteur minimale d'une page A4 (affichage
    // écran) est neutralisée pendant la mesure, sinon tout CV paraîtrait trop long.
    editor.style.minHeight = "0px";
    let size = chosenSize;
    editor.style.fontSize = `${size}px`;
    while (editor.scrollHeight > limit && size > CV_FONT_SIZE_MIN) {
      size = Math.max(CV_FONT_SIZE_MIN, size - FIT_STEP_PX);
      editor.style.fontSize = `${size}px`;
    }
    const contentHeight = editor.scrollHeight;
    editor.style.minHeight = "";
    setFontPx(size);
    setPages(contentHeight / pageHeightPx);
  }, []);

  // Mise en page initiale (le HTML enregistré peut précéder un changement de réglage).
  const layoutApplied = useRef(false);
  useLayoutEffect(() => {
    if (layoutApplied.current || !editorRef.current || !config.hasLayouts) return;
    applyLayout(editorRef.current, initialStyle.layout);
    layoutApplied.current = true;
  }, [initialStyle.layout, config.hasLayouts]);

  // Recalcule l'ajustement à chaque changement de style (police, taille, mise en page)
  // et une fois les polices web chargées (elles changent la hauteur du texte).
  useLayoutEffect(() => {
    fitToPage(style.fontSize);
    let active = true;
    document.fonts?.ready.then(() => active && fitToPage(style.fontSize));
    return () => {
      active = false;
    };
  }, [fitToPage, style]);

  // Après une modification du texte (avec un léger délai pour ne pas recalculer à chaque touche).
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleFit() {
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(() => fitToPage(style.fontSize), 300);
  }
  useEffect(() => () => {
    if (fitTimer.current) clearTimeout(fitTimer.current);
  }, []);

  // Prévient la perte de modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateStyle(patch: Partial<CvStyle>) {
    const next = { ...style, ...patch };
    if (!config.hasLayouts) next.layout = "une_colonne";
    if (next.layout !== style.layout && editorRef.current) applyLayout(editorRef.current, next.layout);
    setStyle(next);
    setDirty(true);
  }

  async function save() {
    if (!editorRef.current) return;
    setSaving(true);
    setError(null);
    const result = await config.save(applicationId, editorRef.current.innerHTML, style);
    setSaving(false);
    if (result.ok) {
      setSavedAt(result.savedAt);
      setDirty(false);
    } else {
      setError(result.error);
    }
  }

  // État des boutons G / I / S et du type de liste selon la sélection dans le CV (comme
  // Google Docs). Hors du CV (ex. focus sur le menu « Type de liste »), l'état et la
  // dernière sélection sont conservés pour pouvoir y appliquer la mise en forme.
  const [activeFormats, setActiveFormats] = useState(NO_ACTIVE_FORMATS);
  const [listType, setListType] = useState<CvListState>(null);
  const lastRange = useRef<Range | null>(null);
  const refreshActiveFormats = useCallback(() => {
    const selection = document.getSelection();
    const editor = editorRef.current;
    if (!editor || !selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return;
    lastRange.current = selection.getRangeAt(0).cloneRange();
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    });
    const list = closestList(selection.anchorNode, editor);
    setListType(list ? listTypeOf(list) : null);
  }, []);
  useEffect(() => {
    document.addEventListener("selectionchange", refreshActiveFormats);
    return () => document.removeEventListener("selectionchange", refreshActiveFormats);
  }, [refreshActiveFormats]);

  function format(command: ToolbarCommand) {
    editorRef.current?.focus();
    // execCommand reste la seule API native d'édition riche des contentEditable.
    document.execCommand(command);
    refreshActiveFormats();
    setDirty(true);
    scheduleFit();
  }

  function changeListType(type: CvListState) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    // Le menu déroulant a pris le focus : on rétablit la sélection faite dans le CV.
    const selection = document.getSelection();
    if (lastRange.current && editor.contains(lastRange.current.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(lastRange.current);
    }
    if (!applyListType(editor, type)) return;
    refreshActiveFormats();
    setDirty(true);
    scheduleFit();
  }

  // Affinage par l'IA : le document est verrouillé pendant la demande (une saisie faite
  // entre-temps serait écrasée par la réponse).
  const [refining, setRefining] = useState(false);

  /** CV affiché, remis en une colonne (structure attendue par l'assistant). */
  function readCvForRefine() {
    const editor = editorRef.current;
    if (!editor) return "";
    const copy = editor.cloneNode(true) as HTMLElement;
    toOneColumn(copy);
    return copy.innerHTML;
  }

  /** Remplace le contenu du document (réponse de l'assistant ou annulation). */
  function replaceDocument(html: string) {
    const editor = editorRef.current;
    if (!editor) return "";
    const previous = editor.innerHTML;
    editor.innerHTML = html;
    if (config.hasLayouts) applyLayout(editor, style.layout);
    setShowMarks(true);
    setDirty(true);
    fitToPage(style.fontSize);
    return previous;
  }

  function exportPdf() {
    fitToPage(style.fontSize);
    // Le titre du document devient le nom de fichier proposé par « Enregistrer au format PDF ».
    const previousTitle = document.title;
    document.title = pdfTitle;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  const fits = pages <= 1.001;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start print:block">
      <div className="min-w-0 space-y-4 print:space-y-0">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur print:hidden">
          {/* Affichage seulement : masquer les surlignages ne modifie pas le document. */}
          <label className="flex cursor-pointer items-center gap-2 px-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showMarks}
              onChange={(e) => setShowMarks(e.target.checked)}
              className="accent-blue-600"
            />
            {config.marksToggle}
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline" aria-live="polite">
              {saving
                ? "Enregistrement…"
                : dirty
                  ? "Modifications non enregistrées"
                  : savedAt
                    ? `Enregistré le ${timeFormatter.format(new Date(savedAt))}`
                    : ""}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || refining}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Enregistrer
            </button>
            <button type="button" onClick={exportPdf} className="btn-primary px-3 py-1.5 text-sm">
              Générer le PDF
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 print:hidden">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-slate-500">
            <mark className="rounded bg-yellow-200 px-1">Surligné</mark> = {config.marksHint}. « Générer le PDF » ouvre l&apos;impression : choisis « Enregistrer
            au format PDF ».
          </p>
          <p
            role="status"
            className={`shrink-0 font-medium ${fits ? "text-emerald-700" : "text-red-700"}`}
          >
            {fits
              ? `✓ Tient sur 1 page${fontPx < style.fontSize ? ` (police ajustée à ${px(fontPx)})` : ""}`
              : `⚠ Dépasse d'une page (${Math.ceil(pages)} pages) même en police 10 px : raccourcis le contenu.`}
          </p>
        </div>

        {/* Page A4 éditable — mêmes dimensions qu'à l'impression */}
        <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
          <div className="relative mx-auto w-[210mm] bg-white shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0">
            <div
              ref={editorRef}
              contentEditable={!refining}
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={config.label}
              spellCheck
              onInput={() => {
                setDirty(true);
                scheduleFit();
              }}
              dangerouslySetInnerHTML={{ __html: initialHtml }}
              style={
                {
                  fontSize: `${fontPx}px`,
                  padding: `${config.paddingMm}mm`,
                  fontFamily: CV_FONTS[style.font].stack,
                  "--cv-accent": CV_ACCENTS[style.accent].value,
                } as React.CSSProperties
              }
              className={`cv-document min-h-[297mm] outline-none focus-visible:ring-2 focus-visible:ring-blue-300 print:min-h-0 ${config.documentClassName} ${
                config.hasLayouts && style.layout === "deux_colonnes" ? twoColumnStyles : ""
              } ${
                showMarks ? "[&_mark]:rounded-sm [&_mark]:bg-yellow-200" : "[&_mark]:bg-transparent"
              } [&_mark]:text-inherit print:[&_mark]:bg-transparent`}
            />
            {/* Repère visuel de fin de page (écran uniquement) */}
            {!fits && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-red-400 print:hidden"
                style={{ top: `${PAGE_HEIGHT_MM}mm` }}
              >
                <span className="absolute right-2 -top-5 rounded bg-red-50 px-1.5 text-[11px] font-medium text-red-700">
                  Fin de la page 1
                </span>
              </div>
            )}
          </div>
        </div>

        {refine && (
          <CvRefineChat
            applicationId={applicationId}
            aiEnabled={refine.aiEnabled}
            usage={refine.usage}
            readCv={readCvForRefine}
            replaceCv={replaceDocument}
            onPendingChange={setRefining}
          />
        )}
      </div>

      <div className="xl:sticky xl:top-6">
        <StylePanel
          kind={kind}
          style={style}
          appliedSize={fontPx}
          onChange={updateStyle}
          activeFormats={activeFormats}
          onFormat={format}
          listType={listType}
          onListType={changeListType}
        />
      </div>
    </div>
  );
}
