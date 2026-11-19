"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

import {
  CV_ACCENT_PRESETS,
  CV_MARGINS,
  CV_SETTING_FONTS,
  CV_SIZES,
  CV_PICKER_TEMPLATES,
  CV_TEMPLATE_DEFAULTS,
  CV_TEMPLATES,
  hasCvSettings,
  type CvData,
  type CvLang,
  type CvTemplateId,
} from "@/lib/cv-builder-types";

import { CvFontFaces, CvThumbnail } from "./cv-html-preview";
import { radioKeyTarget } from "@/lib/cv-thumbnail";

import { CvPhotoPanel } from "./cv-photo-panel";
import { useThumbnailData } from "./use-thumbnail-data";

/** Vraie miniature d'un modèle (format A4), à la largeur de sa carte ; squelette gris tant qu'elle n'est pas mesurée. */
function FittedThumbnail({ id, data, language }: { id: CvTemplateId; data: CvData; language: CvLang }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="aspect-[210/297] overflow-hidden border-b border-line-soft bg-white dark:border-slate-800">
      {width > 0 ? <CvThumbnail data={data} templateId={id} width={width} language={language} /> : <div className="h-full w-full animate-pulse bg-pill dark:bg-slate-800" />}
    </div>
  );
}

/**
 * Grille des modèles proposés (CV_PICKER_TEMPLATES : miniature seule, sans nom), le modèle sélectionné
 * mis en évidence : panneau « Style du CV » et création d'un CV depuis zéro.
 */
export function TemplateGrid({
  selected,
  data,
  language = "fr",
  origin = null,
  onSelect,
}: {
  selected: CvTemplateId;
  /** CV montré dans les vignettes (le vrai CV de la personne ; presque vide : barres grises). */
  data: CvData;
  language?: CvLang;
  /**
   * Ancien modèle du CV à l'ouverture de l'éditeur, quitté depuis : 7e carte « Ton modèle de départ »,
   * pendant la session seulement (hors des 6 modèles proposés).
   */
  origin?: CvTemplateId | null;
  onSelect: (id: CvTemplateId) => void;
}) {
  const shown = useThumbnailData(data, language);
  const cards: { id: CvTemplateId; label: string; caption?: string }[] = CV_PICKER_TEMPLATES.map((t) => ({ id: t.id, label: t.description }));
  if (origin) {
    const description = CV_TEMPLATES.find((t) => t.id === origin)?.description ?? "";
    cards.push({ id: origin, label: `Ton modèle de départ. ${description}`, caption: "Ton modèle de départ" });
  }
  // Groupe de boutons radio : un seul arrêt Tab (la carte cochée, sinon la première), flèches pour changer.
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = cards.findIndex((t) => t.id === selected);
  const focusable = checked === -1 ? 0 : checked;
  return (
    <>
      <CvFontFaces />
      <div role="radiogroup" aria-label="Modèles de CV" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((t, i) => {
          const active = t.id === selected;
          return (
            <button
              key={t.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={i === focusable ? 0 : -1}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => {
                const next = radioKeyTarget(e.key, i, cards.length);
                if (next === null) return;
                e.preventDefault();
                onSelect(cards[next].id);
                buttons.current[next]?.focus();
              }}
              aria-label={t.label}
              title={t.label}
              className={`ui-focus flex min-h-11 w-full flex-col overflow-hidden rounded-block border-2 bg-white text-left transition dark:bg-slate-900 ${
                active
                  ? "border-ink dark:border-blue-600 dark:ring-2 dark:ring-blue-500/20"
                  : "border-line hover:border-line-strong dark:border-slate-700 dark:hover:border-blue-300"
              }`}
            >
              <FittedThumbnail id={t.id} data={shown} language={language} />
              {t.caption ? <span className="px-2.5 py-2 text-xs font-medium text-ink dark:text-slate-200">{t.caption}</span> : null}
            </button>
          );
        })}
      </div>
      {origin ? (
        <p className="text-sm text-muted dark:text-slate-400">
          Ce modèle n&apos;est plus proposé. Tu peux le garder pendant cette session, ou passer à l&apos;un des modèles ci-dessus.
        </p>
      ) : null}
    </>
  );
}

/** Choix d'un réglage parmi quelques valeurs (police, taille, marges). */
function Choices<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="font-semibold text-ink dark:text-white">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={active}
              className={`ui-focus min-h-11 rounded-xl border px-3 text-sm transition lg:min-h-9 ${
                active
                  ? "border-ink bg-pill font-semibold text-ink dark:border-blue-600 dark:bg-blue-500/15 dark:text-white"
                  : "border-line text-prose hover:border-line-strong dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-400"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

type CvStyleSettings = CvData["style"];

/**
 * Panneau « Style du CV » de l'éditeur : modèle (6 cartes avec miniature) et couleur d'accent
 * (pastilles, sélecteur libre, ou couleur du modèle).
 */
export function CvStylePanel({
  data,
  language,
  origin = null,
  templateId,
  accent,
  settings,
  photo,
  onTemplate,
  onAccent,
  onSettings,
  onPhoto,
}: {
  /** Le CV en cours d'édition : montré dans les vignettes des modèles. */
  data: CvData;
  language: CvLang;
  /** Ancien modèle de départ, quitté pendant la session : encore proposé (cf. TemplateGrid). */
  origin?: CvTemplateId | null;
  templateId: CvTemplateId;
  /** Couleur choisie ; vide : couleur du modèle. */
  accent: string;
  /** Réglages du CV (police, taille, marges) : proposés seulement par les modèles réglables. */
  settings: CvStyleSettings;
  /** Photo facultative du CV (data URL JPEG), null sans photo. */
  photo: string | null;
  onTemplate: (id: CvTemplateId) => void;
  onAccent: (accent: string) => void;
  onSettings: (patch: Partial<Pick<CvStyleSettings, "typeface" | "size" | "margins">>) => void;
  onPhoto: (photo: string | null) => void;
}) {
  const templateTitle = useId();
  const accentTitle = useId();
  const pickerId = useId();
  const defaults = CV_TEMPLATE_DEFAULTS[templateId];
  const shown = accent || defaults.accent;

  return (
    <div className="space-y-6">
      <section aria-labelledby={templateTitle} className="space-y-3">
        <h2 id={templateTitle} className="font-semibold text-ink dark:text-white">
          Template
        </h2>
        <TemplateGrid selected={templateId} data={data} language={language} origin={origin} onSelect={onTemplate} />
      </section>

      <CvPhotoPanel photo={photo} templateId={templateId} onChange={onPhoto} />

      <section aria-labelledby={accentTitle} className="space-y-3">
        <h2 id={accentTitle} className="font-semibold text-ink dark:text-white">
          Couleur d&apos;accent
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {CV_ACCENT_PRESETS.map((c) => {
            const active = accent.toLowerCase() === c.value.toLowerCase();
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onAccent(c.value)}
                aria-pressed={active}
                aria-label={c.label}
                title={c.label}
                className={`ui-focus h-11 w-11 rounded-full ring-offset-2 transition lg:h-8 lg:w-8 dark:ring-offset-slate-900 ${
                  active ? "ring-2 ring-ink dark:ring-blue-600" : "ring-1 ring-line hover:ring-line-strong dark:ring-slate-700 dark:hover:ring-slate-400"
                }`}
                style={{ backgroundColor: c.value }}
              />
            );
          })}
          <label htmlFor={pickerId} className="ml-1 flex min-h-11 items-center gap-2 text-sm text-prose lg:min-h-0 dark:text-slate-300">
            <input
              id={pickerId}
              type="color"
              value={shown}
              onChange={(e) => onAccent(e.target.value)}
              className="h-11 w-12 cursor-pointer rounded-xl border border-line bg-white p-1 lg:h-8 lg:w-10 lg:rounded-lg lg:p-0.5 dark:border-slate-700"
            />
            Autre couleur
          </label>
        </div>
        <button
          type="button"
          onClick={() => onAccent("")}
          aria-pressed={!accent}
          className={`ui-focus ui-hit relative text-sm underline-offset-2 hover:underline ${
            accent ? "text-prose dark:text-slate-300" : "font-semibold text-ink dark:font-medium dark:text-blue-300"
          }`}
        >
          Couleur du modèle
        </button>
      </section>

      {hasCvSettings(templateId) ? (
        <>
          <Choices
            title="Police"
            options={CV_SETTING_FONTS.map((f) => ({ id: f.id, label: f.name }))}
            value={settings.typeface || defaults.font || CV_SETTING_FONTS[0].id}
            onChange={(typeface) => onSettings({ typeface })}
          />
          <Choices title="Taille du texte" options={CV_SIZES} value={settings.size ?? "normal"} onChange={(size) => onSettings({ size })} />
          <Choices title="Marges" options={CV_MARGINS} value={settings.margins ?? "normal"} onChange={(margins) => onSettings({ margins })} />
        </>
      ) : null}
    </div>
  );
}
