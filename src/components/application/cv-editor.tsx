"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { saveImprovedCvAction } from "@/app/actions/cv";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

// Géométrie identique à l'écran et à l'impression : page A4 (@page margin 0 dans
// globals.css) avec une marge intérieure de 10 mm → ce qui tient à l'écran tient au PDF.
const PAGE_HEIGHT_MM = 297;
const PAGE_PADDING_MM = 10;
const PX_PER_MM = 96 / 25.4;
/** Petite marge de sécurité (écarts de rendu entre écran et impression). */
const FIT_SAFETY_PX = 6;

const BASE_FONT_PX = 11.5;
const MIN_FONT_PX = 10;
const FONT_STEP_PX = 0.25;

// Mise en forme du document (HTML sans classes : balises stylées par le conteneur).
// Tailles en em : tout le CV suit la taille de police ajustée pour tenir sur 1 page.
// Hiérarchie : nom > titre > sections > contenu. Une seule colonne, vrais titres :
// structure lisible par les ATS.
const documentStyles = [
  // Nom
  "[&_h1]:text-[2.3em] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-950",
  // Titre (1er paragraphe en gras sous le nom) et coordonnées
  "[&_h1+p]:mt-1 [&_h1+p]:text-[1.2em] [&_h1+p]:font-semibold [&_h1+p]:text-blue-800",
  "[&_h1+p+p]:mt-0.5 [&_h1+p+p]:text-[0.95em] [&_h1+p+p]:text-slate-600",
  // Sections : séparées par une ligne fine
  "[&_h2]:mt-[1.1em] [&_h2]:mb-[0.45em] [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-[0.2em] [&_h2]:text-[1.05em] [&_h2]:font-bold [&_h2]:tracking-[0.08em] [&_h2]:text-slate-900 [&_h2]:uppercase",
  // Entrées (poste, diplôme…) et leurs métadonnées (structure · dates)
  "[&_h3]:mt-[0.7em] [&_h3]:text-[1.02em] [&_h3]:font-semibold [&_h3]:text-slate-900",
  "[&_em]:text-[0.95em] [&_em]:text-slate-500 [&_em]:not-italic",
  // Contenu
  "[&_p]:my-[0.15em] [&_ul]:my-[0.25em] [&_ul]:list-disc [&_ul]:pl-[1.3em] [&_ol]:list-decimal [&_ol]:pl-[1.3em] [&_li]:my-[0.1em] [&_li]:pl-[0.1em]",
  "[&_strong]:font-semibold",
].join(" ");

type ToolbarCommand = "bold" | "italic" | "insertUnorderedList";

export function CvEditor({
  applicationId,
  initialHtml,
  savedAt: initialSavedAt,
  pdfTitle,
}: {
  applicationId: string;
  initialHtml: string;
  savedAt: string | null;
  /** Titre du document pendant l'impression = nom de fichier proposé pour le PDF. */
  pdfTitle: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [error, setError] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(true);
  const [fontPx, setFontPx] = useState(BASE_FONT_PX);
  /** Hauteur du contenu en nombre de pages A4 (≤ 1 : tient sur une page). */
  const [pages, setPages] = useState(1);

  // Ajuste la taille de police pour que le CV tienne sur une page A4 (10 px minimum).
  const fitToPage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const pageHeightPx = PAGE_HEIGHT_MM * PX_PER_MM;
    const limit = pageHeightPx - FIT_SAFETY_PX;
    // Mesure la hauteur réelle du contenu : la hauteur minimale d'une page A4 (affichage
    // écran) est neutralisée pendant la mesure, sinon tout CV paraîtrait trop long.
    editor.style.minHeight = "0px";
    let size = BASE_FONT_PX;
    editor.style.fontSize = `${size}px`;
    while (editor.scrollHeight > limit && size > MIN_FONT_PX) {
      size = Math.max(MIN_FONT_PX, size - FONT_STEP_PX);
      editor.style.fontSize = `${size}px`;
    }
    const contentHeight = editor.scrollHeight;
    editor.style.minHeight = "";
    setFontPx(size);
    setPages(contentHeight / pageHeightPx);
  }, []);

  // Au chargement (une fois la police Inter prête, elle change la hauteur du texte).
  useLayoutEffect(() => {
    fitToPage();
    let active = true;
    document.fonts?.ready.then(() => active && fitToPage());
    return () => {
      active = false;
    };
  }, [fitToPage]);

  // Après une modification (avec un léger délai pour ne pas recalculer à chaque touche).
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleFit() {
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(fitToPage, 300);
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

  async function save() {
    if (!editorRef.current) return;
    setSaving(true);
    setError(null);
    const result = await saveImprovedCvAction(applicationId, editorRef.current.innerHTML);
    setSaving(false);
    if (result.ok) {
      setSavedAt(result.savedAt);
      setDirty(false);
    } else {
      setError(result.error);
    }
  }

  function format(command: ToolbarCommand) {
    editorRef.current?.focus();
    // execCommand reste la seule API native d'édition riche des contentEditable.
    document.execCommand(command);
    setDirty(true);
    scheduleFit();
  }

  function exportPdf() {
    fitToPage();
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
  const toolbarButton =
    "rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50";

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur print:hidden">
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <button type="button" onClick={() => format("bold")} className={toolbarButton} title="Gras">
            <strong>G</strong>
          </button>
          <button type="button" onClick={() => format("italic")} className={toolbarButton} title="Italique">
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => format("insertUnorderedList")}
            className={toolbarButton}
            title="Liste à puces"
          >
            • Liste
          </button>
        </div>

        {/* Affichage seulement : masquer les surlignages ne modifie pas le document. */}
        <label className="flex cursor-pointer items-center gap-2 px-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showMarks}
            onChange={(e) => setShowMarks(e.target.checked)}
            className="accent-blue-600"
          />
          Surligner les améliorations
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
            disabled={saving || !dirty}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="btn-primary px-3 py-1.5 text-sm"
          >
            Exporter en PDF
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
          <mark className="rounded bg-yellow-200 px-1">Surligné</mark> = passage ajouté ou reformulé
          par l&apos;assistant. Clique dans le document pour le modifier. « Exporter en PDF » ouvre
          l&apos;impression : choisis « Enregistrer au format PDF ».
        </p>
        <p
          role="status"
          className={`shrink-0 font-medium ${fits ? "text-emerald-700" : "text-red-700"}`}
        >
          {fits
            ? `✓ Tient sur 1 page${fontPx < BASE_FONT_PX ? ` (police ajustée à ${fontPx.toLocaleString("fr-FR")} px)` : ""}`
            : `⚠ Dépasse d'une page (${Math.ceil(pages)} pages) même en police 10 px : raccourcis le contenu.`}
        </p>
      </div>

      {/* Page A4 éditable — mêmes dimensions qu'à l'impression */}
      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
        <div className="relative mx-auto w-[210mm] bg-white shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="CV amélioré, modifiable"
            spellCheck
            onInput={() => {
              setDirty(true);
              scheduleFit();
            }}
            dangerouslySetInnerHTML={{ __html: initialHtml }}
            style={{ fontSize: `${fontPx}px`, padding: `${PAGE_PADDING_MM}mm` }}
            className={`min-h-[297mm] leading-[1.4] text-slate-800 [font-family:var(--font-inter),Arial,Helvetica,sans-serif] outline-none focus-visible:ring-2 focus-visible:ring-blue-300 print:min-h-0 ${documentStyles} ${
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
    </div>
  );
}
