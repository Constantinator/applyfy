"use client";

import { useEffect, useRef, useState } from "react";

import { saveImprovedCvAction } from "@/app/actions/cv";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

// Mise en forme du document (HTML sans classes : balises stylées par le conteneur).
const documentStyles = [
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:tracking-wide [&_h2]:text-indigo-800 [&_h2]:uppercase",
  "[&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-slate-900",
  "[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_em]:text-slate-500",
].join(" ");

type ToolbarCommand = "bold" | "italic" | "insertUnorderedList";

export function CvEditor({
  applicationId,
  initialHtml,
  savedAt: initialSavedAt,
}: {
  applicationId: string;
  initialHtml: string;
  savedAt: string | null;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [error, setError] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(true);

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
  }

  const toolbarButton =
    "rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50";

  return (
    <div className="space-y-4">
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
            className="accent-violet-600"
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
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
          >
            Exporter en PDF
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 print:hidden">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-500 print:hidden">
        <mark className="rounded bg-yellow-200 px-1">Surligné</mark> = passage ajouté ou reformulé par
        l&apos;assistant. Clique dans le document pour le modifier. « Exporter en PDF » ouvre
        l&apos;impression : choisis « Enregistrer au format PDF » (les surlignages ne sont pas
        imprimés).
      </p>

      {/* Page A4 éditable */}
      <div className="rounded-sm bg-white shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="CV amélioré, modifiable"
          spellCheck
          onInput={() => setDirty(true)}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          className={`mx-auto min-h-[297mm] max-w-[210mm] px-[16mm] py-[14mm] text-[13px] leading-relaxed text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-violet-300 print:min-h-0 print:max-w-none print:p-0 ${documentStyles} ${
            showMarks ? "[&_mark]:rounded-sm [&_mark]:bg-yellow-200" : "[&_mark]:bg-transparent"
          } print:[&_mark]:bg-transparent`}
        />
      </div>
    </div>
  );
}
