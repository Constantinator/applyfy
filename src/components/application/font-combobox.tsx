"use client";

import { useId, useRef, useState } from "react";

import { CV_FONTS, type CvFont } from "@/lib/cv-style";

const FONT_KEYS = Object.keys(CV_FONTS) as CvFont[];

/** Comparaison insensible à la casse et aux accents. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Sélecteur de police façon Google Docs : champ texte filtrant + liste déroulante,
 * chaque police affichée dans sa propre police. Motif ARIA « combobox » (clavier :
 * ↑ ↓ pour naviguer, Entrée pour choisir, Échap pour annuler).
 */
export function FontCombobox({
  id: inputId,
  value,
  onChange,
}: {
  /** id du champ, pour l'associer à un <label>. */
  id?: string;
  value: CvFont;
  onChange: (font: CvFont) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null : affiche la police actuelle
  const [active, setActive] = useState(0);

  const filtered = query === null ? FONT_KEYS : FONT_KEYS.filter((f) => normalize(CV_FONTS[f].label).includes(normalize(query)));

  function openList() {
    setOpen(true);
    setActive(Math.max(0, FONT_KEYS.indexOf(value)));
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(font: CvFont) {
    onChange(font);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      if (filtered.length === 0) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-label={inputId ? undefined : "Police"}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${id}-${filtered[active]}` : undefined}
        value={query ?? CV_FONTS[value].label}
        onFocus={(e) => {
          openList();
          e.currentTarget.select();
        }}
        onClick={() => {
          if (!open) openList();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
        style={{ fontFamily: CV_FONTS[value].stack }}
        className="ui-input h-11 min-h-0 py-0 pr-9 pl-3.5 hover:border-[#C4C4C4]"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Afficher les polices"
        // mousedown : garde le focus dans le champ (sinon onBlur fermerait la liste).
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) close();
          else inputRef.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted hover:text-ink"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Polices disponibles"
          className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-auto rounded-block border border-line bg-white py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-muted">Aucune police trouvée</li>
          ) : (
            filtered.map((font, index) => (
              <li
                key={font}
                id={`${id}-${font}`}
                role="option"
                aria-selected={font === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(font);
                }}
                onMouseEnter={() => setActive(index)}
                style={{ fontFamily: CV_FONTS[font].stack }}
                className={`flex min-h-11 cursor-pointer items-center justify-between px-3.5 py-2 text-[15px] text-ink lg:min-h-0 ${
                  index === active ? "bg-pill" : ""
                }`}
              >
                {CV_FONTS[font].label}
                {font === value && (
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 text-accent">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                  </svg>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
