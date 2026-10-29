"use client";

import { useId } from "react";

import { CV_ACCENT_PRESETS, CV_TEMPLATES, type CvTemplateId } from "@/lib/cv-builder-types";

/** Couleur d'accent propre à chaque modèle (utilisée quand aucune couleur n'est choisie). */
const TEMPLATE_ACCENTS: Record<CvTemplateId, string> = {
  minimaliste: "#111827",
  classique: "#111827",
  moderne: "#1E40AF",
  sidebar: "#1E293B",
  tech: "#059669",
  finance: "#000000",
};

/** Ligne de texte grise de la miniature. */
function Line({ width = "100%" }: { width?: string }) {
  return <span className="block h-[3px] rounded-full bg-slate-200" style={{ width }} />;
}

/** Bloc « titre de section + lignes » de la miniature. */
function Section({ accent, title }: { accent: string; title: "bar" | "underline" | "plain" | "framed" }) {
  return (
    <span className="block space-y-[3px]">
      {title === "bar" ? (
        <span className="flex items-center gap-1">
          <span className="block h-[6px] w-[2px] rounded-sm" style={{ backgroundColor: accent }} />
          <span className="block h-[3px] w-1/3 rounded-full" style={{ backgroundColor: accent }} />
        </span>
      ) : title === "framed" ? (
        <span className="block border-y py-[1px]" style={{ borderColor: accent }}>
          <span className="mx-auto block h-[3px] w-1/3 rounded-full" style={{ backgroundColor: accent }} />
        </span>
      ) : (
        <span className={`block ${title === "underline" ? "border-b pb-[2px]" : ""}`} style={{ borderColor: accent }}>
          <span className="block h-[3px] w-1/3 rounded-full" style={{ backgroundColor: accent }} />
        </span>
      )}
      <Line />
      <Line width="80%" />
    </span>
  );
}

/** Aperçu simplifié de la mise en page d'un modèle, dans la couleur d'accent. */
function TemplateThumbnail({ id, accent }: { id: CvTemplateId; accent: string }) {
  if (id === "sidebar") {
    return (
      <span className="flex h-full">
        <span className="flex w-[30%] flex-col gap-1.5 bg-slate-800 p-1.5">
          <span className="block h-[3px] w-3/4 rounded-full bg-blue-300" />
          <span className="block h-[3px] rounded-full bg-slate-500" />
          <span className="block h-[3px] w-2/3 rounded-full bg-slate-500" />
        </span>
        <span className="flex flex-1 flex-col gap-2 p-1.5">
          <span className="block h-[5px] w-2/3 rounded-full" style={{ backgroundColor: accent }} />
          <Section accent={accent} title="underline" />
          <Section accent={accent} title="underline" />
        </span>
      </span>
    );
  }
  const centered = id === "classique" || id === "finance";
  return (
    <span className="flex h-full flex-col gap-2 p-2">
      <span className={`flex items-center gap-1.5 ${centered ? "justify-center" : ""}`}>
        {id === "moderne" && <span className="block h-3 w-3 shrink-0 rounded-full bg-slate-300" />}
        <span className={`flex flex-col gap-[3px] ${centered ? "items-center" : ""} flex-1`}>
          <span
            className="block h-[5px] w-2/3 rounded-full"
            style={{ backgroundColor: id === "moderne" ? accent : "#1F2937" }}
          />
          <span className="block h-[3px] w-1/2 rounded-full" style={{ backgroundColor: id === "tech" ? accent : "#CBD5E1" }} />
        </span>
      </span>
      {id === "minimaliste" && <span className="block h-px" style={{ backgroundColor: accent }} />}
      <Section accent={accent} title={id === "tech" ? "bar" : id === "finance" ? "framed" : id === "minimaliste" ? "plain" : "underline"} />
      <Section accent={accent} title={id === "tech" ? "bar" : id === "finance" ? "framed" : id === "minimaliste" ? "plain" : "underline"} />
    </span>
  );
}

/**
 * Panneau « Style du CV » de l'éditeur : modèle (6 cartes avec miniature) et couleur d'accent
 * (pastilles, sélecteur libre, ou couleur du modèle).
 */
export function CvStylePanel({
  templateId,
  accent,
  onTemplate,
  onAccent,
}: {
  templateId: CvTemplateId;
  /** Couleur choisie ; vide : couleur du modèle. */
  accent: string;
  onTemplate: (id: CvTemplateId) => void;
  onAccent: (accent: string) => void;
}) {
  const templateTitle = useId();
  const accentTitle = useId();
  const pickerId = useId();
  const shown = accent || TEMPLATE_ACCENTS[templateId];

  return (
    <div className="space-y-6">
      <section aria-labelledby={templateTitle} className="space-y-3">
        <h2 id={templateTitle} className="font-semibold text-slate-900 dark:text-white">
          Template
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CV_TEMPLATES.map((t) => {
            const active = t.id === templateId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onTemplate(t.id)}
                  aria-pressed={active}
                  title={t.description}
                  className={`flex w-full flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition dark:bg-slate-900 ${
                    active
                      ? "border-blue-600 ring-2 ring-blue-100 dark:ring-blue-500/20"
                      : "border-slate-200 hover:border-blue-300 dark:border-slate-700"
                  }`}
                >
                  <span aria-hidden="true" className="block aspect-[3/4] border-b border-slate-100 bg-white dark:border-slate-800">
                    <TemplateThumbnail id={t.id} accent={accent || TEMPLATE_ACCENTS[t.id]} />
                  </span>
                  <span className="px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">{t.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={accentTitle} className="space-y-3">
        <h2 id={accentTitle} className="font-semibold text-slate-900 dark:text-white">
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
                className={`h-8 w-8 rounded-full ring-offset-2 transition dark:ring-offset-slate-900 ${
                  active ? "ring-2 ring-blue-600" : "ring-1 ring-slate-200 hover:ring-slate-400 dark:ring-slate-700"
                }`}
                style={{ backgroundColor: c.value }}
              />
            );
          })}
          <label htmlFor={pickerId} className="ml-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              id={pickerId}
              type="color"
              value={shown}
              onChange={(e) => onAccent(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700"
            />
            Autre couleur
          </label>
        </div>
        <button
          type="button"
          onClick={() => onAccent("")}
          aria-pressed={!accent}
          className={`text-sm underline-offset-2 hover:underline ${
            accent ? "text-slate-600 dark:text-slate-300" : "font-medium text-blue-700 dark:text-blue-300"
          }`}
        >
          Couleur du modèle
        </button>
      </section>
    </div>
  );
}
