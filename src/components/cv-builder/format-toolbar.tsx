"use client";

import { CV_DENSITIES, CV_FONTS, type CvData, type CvDensity, type CvFontId } from "@/lib/cv-builder-types";
import { toggleRich, type RichFormat } from "@/lib/cv-rich-text";

import type { EditPath } from "./cv-primitives";

// Barre d'outils de l'éditeur du CV Builder (comme celle de l'éditeur du CV d'une
// candidature) : gras / italique / souligné sur la sélection du champ actif (formulaire ou
// aperçu), police, taille du texte et alignement pour tout le CV.

const FORMATS: { format: RichFormat; title: string; label: React.ReactNode }[] = [
  { format: "bold", title: "Gras", label: <strong>G</strong> },
  { format: "italic", title: "Italique", label: <em className="font-serif">I</em> },
  { format: "underline", title: "Souligné", label: <span className="underline underline-offset-2">S</span> },
];

/** Position d'un point de la sélection dans le texte de `root`. */
function textOffset(root: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * Applique la mise en forme à la sélection du champ actif :
 * - champ du formulaire (input / textarea) : valeur modifiée comme une saisie (onChange) ;
 * - texte de l'aperçu en cours de modification : `onPreviewEdit`.
 */
function applyFormat(format: RichFormat, onPreviewEdit: (path: EditPath, value: string) => void) {
  const el = document.activeElement;
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.closest("[data-cv-form]")) {
    // Champs sans sélection de texte (email, adresse web…) : selectionStart vaut null.
    if (el.selectionStart === null || el.selectionEnd === null) return;
    const result = toggleRich(el.value, el.selectionStart, el.selectionEnd, format);
    if (result.value === el.value) return;
    // Valeur modifiée par le setter natif, puis événement « input » : React met son état à jour.
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set?.call(el, result.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    requestAnimationFrame(() => el.setSelectionRange(result.start, result.end));
    return;
  }
  if (el instanceof HTMLElement && el.dataset.editPath) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return;
    const value = el.textContent ?? "";
    const start = textOffset(el, range.startContainer, range.startOffset);
    const end = textOffset(el, range.endContainer, range.endOffset);
    const result = toggleRich(value, start, end, format);
    if (result.value === value) return;
    el.textContent = result.value;
    const text = el.firstChild;
    if (text) {
      const next = document.createRange();
      next.setStart(text, result.start);
      next.setEnd(text, result.end);
      selection.removeAllRanges();
      selection.addRange(next);
    }
    onPreviewEdit(el.dataset.editPath, result.value);
  }
}

const buttonClass = (active: boolean) =>
  `flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors ${
    active
      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
  }`;

export function FormatToolbar({
  style,
  onStyle,
  onPreviewEdit,
}: {
  style: CvData["style"];
  onStyle: (patch: Partial<CvData["style"]>) => void;
  onPreviewEdit: (path: EditPath, value: string) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Mise en forme"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="flex items-center gap-0.5">
        {FORMATS.map(({ format, title, label }) => (
          <button
            key={format}
            type="button"
            title={`${title} (sélectionne d'abord du texte)`}
            aria-label={title}
            // Le champ actif garde le focus et sa sélection.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat(format, onPreviewEdit)}
            className={buttonClass(false)}
          >
            {label}
          </button>
        ))}
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        Police
        <select
          value={style.font}
          onChange={(e) => onStyle({ font: e.target.value as CvFontId })}
          className="input w-48 py-1.5"
        >
          {CV_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        Taille
        <select
          value={style.density}
          onChange={(e) => onStyle({ density: e.target.value as CvDensity })}
          className="input w-32 py-1.5"
        >
          {CV_DENSITIES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div role="group" aria-label="Alignement des paragraphes" className="flex items-center gap-0.5">
        {(
          [
            { value: "left", title: "Aligné à gauche", path: "M4 6h16M4 10h10M4 14h16M4 18h10" },
            { value: "justify", title: "Justifié", path: "M4 6h16M4 10h16M4 14h16M4 18h16" },
          ] as const
        ).map((a) => (
          <button
            key={a.value}
            type="button"
            title={a.title}
            aria-label={a.title}
            aria-pressed={style.align === a.value}
            onClick={() => onStyle({ align: a.value })}
            className={buttonClass(style.align === a.value)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d={a.path} />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
