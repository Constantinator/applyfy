"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CV_ACCENT_PRESETS, CV_TEMPLATES, CvDataSchema, type CvTemplateId } from "@/lib/cv-builder-types";

import { CvFontFaces, CvThumbnail } from "./cv-html-preview";

/** Couleur d'accent propre à chaque modèle (utilisée quand aucune couleur n'est choisie). */
const TEMPLATE_ACCENTS: Record<CvTemplateId, string> = {
  minimaliste: "#111827",
  classique: "#111827",
  moderne: "#1E40AF",
  sidebar: "#1E293B",
  tech: "#059669",
  finance: "#000000",
};

/** CV fictif des miniatures de la grille. */
const SAMPLE_CV = CvDataSchema.parse({
  personal: {
    firstName: "Sophie",
    lastName: "Martin",
    jobTitle: "Analyste Financière",
    email: "sophie.martin@email.com",
    city: "Paris",
    linkedin: "linkedin.com/in/sophiemartin",
  },
  summary: "Étudiante en finance avec expérience en analyse de données et gestion de portefeuille.",
  experiences: [
    {
      id: "bnp",
      position: "Analyste junior",
      company: "BNP Paribas",
      location: "Paris",
      startDate: "2024",
      current: true,
      bullets: [
        "Réalisé 3 reportings financiers mensuels présentés à la direction",
        "Analysé un portefeuille de 50 M€ avec un taux de rendement de +8 %",
        "Automatisé les tableaux de bord Excel, réduisant le temps de traitement de 40 %",
      ],
    },
    {
      id: "lvmh",
      position: "Stage contrôle de gestion",
      company: "LVMH",
      location: "Paris",
      startDate: "2023",
      bullets: ["Suivi budgétaire de 3 départements (budget cumulé : 2 M€)", "Préparé les clôtures mensuelles et trimestrielles"],
    },
    {
      id: "lazard",
      position: "Analyste M&A",
      company: "Lazard",
      location: "Paris",
      startDate: "2022",
      endDate: "2023",
      bullets: [
        "Modélisé 4 transactions (valorisation DCF et LBO) pour des cibles entre 50 M€ et 200 M€",
        "Préparé les pitchbooks pour 3 comités d'investissement",
      ],
    },
  ],
  education: [
    { id: "hec", degree: "Master Finance", school: "HEC Paris", startDate: "2022", endDate: "2024" },
    { id: "dauphine", degree: "Licence Économie-Gestion", school: "Université Paris-Dauphine", startDate: "2019", endDate: "2022" },
  ],
  skills: ["Excel", "Bloomberg", "Python", "Power BI", "Modélisation DCF/LBO", "SQL", "PowerPoint"].map((name) => ({ id: name, name })),
  languages: [
    { id: "fr", name: "Français", level: "Natif" },
    { id: "en", name: "Anglais", level: "Courant (TOEIC 945)" },
    { id: "es", name: "Espagnol", level: "Intermédiaire" },
  ],
  interests: "Échecs (tournois régionaux), Tennis, Lecture (économie comportementale)",
});

/** Vraie miniature d'un modèle (format A4), à la largeur de sa carte. */
function FittedThumbnail({ id, accent }: { id: CvTemplateId; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const data = useMemo(() => ({ ...SAMPLE_CV, style: { ...SAMPLE_CV.style, accent } }), [accent]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="aspect-[210/297] overflow-hidden border-b border-line-soft bg-white dark:border-slate-800">
      {width > 0 && <CvThumbnail data={data} templateId={id} width={width} />}
    </div>
  );
}

/**
 * Grille des 6 modèles (miniature et nom), le modèle sélectionné mis en évidence : panneau
 * « Style du CV » et création d'un CV depuis zéro.
 */
export function TemplateGrid({
  selected,
  accent = "",
  onSelect,
}: {
  selected: CvTemplateId;
  /** Couleur des miniatures ; vide : couleur de chaque modèle. */
  accent?: string;
  onSelect: (id: CvTemplateId) => void;
}) {
  return (
    <>
      <CvFontFaces />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CV_TEMPLATES.map((t) => {
          const active = t.id === selected;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-pressed={active}
                title={t.description}
                className={`ui-focus flex w-full flex-col overflow-hidden rounded-block border-2 bg-white text-left transition dark:bg-slate-900 ${
                  active
                    ? "border-ink dark:border-blue-600 dark:ring-2 dark:ring-blue-500/20"
                    : "border-line hover:border-line-strong dark:border-slate-700 dark:hover:border-blue-300"
                }`}
              >
                <FittedThumbnail id={t.id} accent={accent} />
                <span className={`px-2.5 py-2 text-xs text-ink dark:text-slate-200 ${active ? "font-semibold" : "font-medium"}`}>{t.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
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
        <h2 id={templateTitle} className="font-semibold text-ink dark:text-white">
          Template
        </h2>
        <TemplateGrid selected={templateId} accent={accent} onSelect={onTemplate} />
      </section>

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
    </div>
  );
}
