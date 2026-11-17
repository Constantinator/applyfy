"use client";

import { useId } from "react";

import { CV_SECTION_TITLES, type CvLang } from "@/lib/cv-builder-types";

const LANG_NAMES: Record<CvLang, string> = { fr: "Français", en: "English" };

/**
 * « Langue du CV » (onglet Style) : change les titres des rubriques et « Aujourd'hui / Present »
 * de l'aperçu et du PDF, sans traduire le contenu. `children` : la traduction du CV, en dessous.
 */
export function CvLanguagePanel({
  language,
  saving,
  error,
  onChange,
  children,
}: {
  language: CvLang;
  saving: boolean;
  error: string | null;
  onChange: (language: CvLang) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const other: CvLang = language === "fr" ? "en" : "fr";
  return (
    <section aria-labelledby={`${id}-title`} className="mt-6 border-t border-line-soft pt-5 dark:border-slate-700">
      <h3 id={`${id}-title`} className="text-sm font-semibold text-ink dark:text-white">
        Langue du CV
      </h3>
      <label htmlFor={`${id}-select`} className="mt-3 block text-[13px] text-prose dark:text-slate-300">
        Titres des rubriques
      </label>
      <select
        id={`${id}-select`}
        value={language}
        disabled={saving}
        onChange={(event) => onChange(event.target.value as CvLang)}
        aria-describedby={`${id}-help`}
        className="ui-input mt-1.5 w-full py-2"
      >
        {(["fr", "en"] as const).map((lang) => (
          <option key={lang} value={lang}>
            {LANG_NAMES[lang]}
          </option>
        ))}
      </select>
      <p id={`${id}-help`} className="mt-2 text-xs text-muted dark:text-slate-400">
        Change seulement les titres des rubriques (« {CV_SECTION_TITLES[language].experiences} » devient « {CV_SECTION_TITLES[other].experiences} ») et
        « {CV_SECTION_TITLES[language].present} ». Le contenu de ton CV n&apos;est pas traduit.
      </p>
      {error && (
        <p role="alert" className="ui-notice-error mt-3 px-3 py-2 text-xs">
          {error}
        </p>
      )}
      {children}
    </section>
  );
}
