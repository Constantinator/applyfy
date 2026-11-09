"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { refineCoverLetterAction, saveCoverLetterAction } from "@/app/actions/cover-letter";
import type { AiUsageCount } from "@/lib/ai-usage-limits";
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
  DEFAULT_LETTER_STYLE,
  type CvAccent,
  type CvStyle,
} from "@/lib/cv-style";

import { FontCombobox } from "./font-combobox";
import { RefineChat } from "./refine-chat";

const hourFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

// Géométrie identique à l'écran et à l'impression : page A4 (@page margin 0 dans
// globals.css) avec une marge intérieure de 20 mm → ce qui tient à l'écran tient au PDF.
const PAGE_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
/** Petite marge de sécurité (écarts de rendu entre écran et impression). */
const FIT_SAFETY_PX = 6;
/** Pas de réduction automatique de la police pour tenir sur 1 page. */
const FIT_STEP_PX = 0.25;

const px = (value: number) => `${value.toLocaleString("fr-FR")} px`;

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
  lettre: {
    save: saveCoverLetterAction,
    refine: refineCoverLetterAction,
    defaultStyle: DEFAULT_LETTER_STYLE,
    documentClassName: letterStyles,
    // Marges plus larges, d'usage pour un courrier.
    paddingMm: 20,
    label: "Lettre de motivation, modifiable",
    inDocument: "dans la lettre",
    marksToggle: "Surligner la personnalisation",
    marksHint: "passage personnalisé pour cette offre : vérifie qu'il est exact",
    accentHint: "nom et objet",
  },
} as const;

export type EditorKind = keyof typeof EDITOR_KINDS;

/** Panneau de mise en forme : police, taille, gras/italique/liste, couleur. */
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
  const sectionTitle = "text-xs font-semibold tracking-wide text-muted uppercase";
  const config = EDITOR_KINDS[kind];
  return (
    <aside aria-label="Mise en forme du document" className="ui-card space-y-6 p-5 print:hidden">
      <h2 className="font-semibold text-ink">Mise en forme</h2>

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
          <output htmlFor="cv-size" className="text-sm font-semibold text-ink tabular-nums">
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
          className="h-11 w-full accent-accent lg:h-auto"
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>{px(CV_FONT_SIZE_MIN)}</span>
          <span>{px(CV_FONT_SIZE_MAX)}</span>
        </div>
        {appliedSize < style.fontSize && (
          <p className="text-xs text-amber-800">
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
                className={`ui-focus h-11 rounded-xl border text-sm font-medium transition lg:h-9 ${
                  active ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-line-strong hover:bg-surface"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label htmlFor="cv-list-type" className="block pt-1 text-xs font-medium text-prose">
          Type de liste
        </label>
        <select
          id="cv-list-type"
          value={listType ?? NO_LIST}
          onChange={(e) => onListType(e.target.value === NO_LIST ? null : (e.target.value as CvListType))}
          className="ui-input"
        >
          {(Object.keys(CV_LIST_TYPES) as CvListType[]).map((type) => (
            <option key={type} value={type}>
              {CV_LIST_TYPES[type]}
            </option>
          ))}
          <option value={NO_LIST}>Sans liste</option>
        </select>
        <p className="text-xs text-muted">S&apos;applique au texte sélectionné {config.inDocument}.</p>
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
                className={`ui-focus h-11 w-11 rounded-full ring-offset-2 transition lg:h-8 lg:w-8 ${
                  selected ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-line-strong"
                }`}
                style={{ backgroundColor: CV_ACCENTS[accent].value }}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted">
          {CV_ACCENTS[style.accent].label} · {config.accentHint}
        </p>
      </fieldset>


      <button
        type="button"
        onClick={() => onChange(config.defaultStyle)}
        className="ui-btn-secondary w-full"
      >
        Réinitialiser
      </button>
    </aside>
  );
}

/**
 * Éditeur de la lettre de motivation (une page A4) : texte modifiable, panneau de mise en forme,
 * enregistrement et export PDF.
 */
export function CvEditor({
  kind = "lettre",
  applicationId,
  initialHtml,
  initialStyle,
  savedAt: initialSavedAt,
  pdfTitle,
  refine,
  autosaveAfterManualSave = false,
}: {
  kind?: EditorKind;
  applicationId: string;
  initialHtml: string;
  initialStyle: CvStyle;
  savedAt: string | null;
  /** Titre du document pendant l'impression = nom de fichier proposé pour le PDF. */
  pdfTitle: string;
  /** Chat « Affiner avec l'IA » sous le document ; `initialPrompt` : demande envoyée à l'ouverture. */
  refine?: { aiEnabled: boolean; usage: AiUsageCount; resetLabel: string; initialPrompt?: string };
  /**
   * Sauvegarde automatique seulement après un premier « Enregistrer » : nouveau document
   * ouvert à la place d'un document déjà enregistré, qu'il ne doit pas écraser d'office.
   */
  autosaveAfterManualSave?: boolean;
}) {
  const config = EDITOR_KINDS[kind];
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [autosaveEnabled, setAutosaveEnabled] = useState(!autosaveAfterManualSave);
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

  // Sauvegarde automatique : toutes les 30 secondes si le contenu a changé, et au départ
  // de la page (meilleur effort : le navigateur peut interrompre la requête).
  const autosave = useRef<() => void>(() => {});
  useEffect(() => {
    autosave.current = () => {
      if (autosaveEnabled && dirty && !saving && !refining) void save();
    };
  });
  useEffect(() => {
    const timer = setInterval(() => autosave.current(), 30_000);
    const onLeave = () => autosave.current();
    const onHidden = () => document.visibilityState === "hidden" && autosave.current();
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  function updateStyle(patch: Partial<CvStyle>) {
    setStyle({ ...style, ...patch, layout: "une_colonne" });
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
      setAutosaveEnabled(true);
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

  /** Document affiché. */
  function readDocumentForRefine() {
    return editorRef.current?.innerHTML ?? "";
  }

  /** Remplace le contenu du document (réponse de l'assistant ou annulation). */
  function replaceDocument(html: string) {
    const editor = editorRef.current;
    if (!editor) return "";
    const previous = editor.innerHTML;
    editor.innerHTML = html;
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
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-block border border-line bg-white p-2 lg:top-18 print:hidden">
          {/* Affichage seulement : masquer les surlignages ne modifie pas le document. */}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm text-ink lg:min-h-0">
            <input
              type="checkbox"
              checked={showMarks}
              onChange={(e) => setShowMarks(e.target.checked)}
              className="accent-accent"
            />
            {config.marksToggle}
          </label>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline" aria-live="polite">
              {saving
                ? "Enregistrement…"
                : dirty
                  ? autosaveEnabled
                    ? "Modifications en cours..."
                    : "Modifications non enregistrées"
                  : savedAt
                    ? `Enregistré à ${hourFormatter.format(new Date(savedAt))}`
                    : ""}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || refining}
              className="ui-btn-secondary px-4 py-2 text-[13px]"
            >
              Enregistrer
            </button>
            <button type="button" onClick={exportPdf} className="ui-btn-primary px-4 py-2 text-[13px]">
              Générer le PDF
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="ui-notice-error px-4 py-3 text-sm print:hidden">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-muted">
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
        {/* Feuille blanche sur fond gris très léger, comme l'aperçu du CV Builder. */}
        <div className="overflow-x-auto rounded-card bg-[#F7F7F8] p-4 print:overflow-visible print:rounded-none print:bg-transparent print:p-0">
          <div className="relative mx-auto w-[210mm] bg-white ring-1 ring-line print:ring-0">
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
              className={`cv-document min-h-[297mm] outline-none focus-visible:ring-2 focus-visible:ring-accent/40 print:min-h-0 ${config.documentClassName} ${
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
          <RefineChat
            document={kind}
            applicationId={applicationId}
            aiEnabled={refine.aiEnabled}
            usage={refine.usage}
            resetLabel={refine.resetLabel}
            refine={config.refine}
            readDocument={readDocumentForRefine}
            replaceDocument={replaceDocument}
            onPendingChange={setRefining}
            initialPrompt={refine.initialPrompt}
          />
        )}
      </div>

      <div className="xl:sticky xl:top-22 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
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
