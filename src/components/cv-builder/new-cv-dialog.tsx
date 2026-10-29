"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";

import { createBuilderCvAction } from "@/app/actions/cv-builder";
import { CV_TEMPLATES, CvDataSchema, type CvData, type CvTemplateId } from "@/lib/cv-builder-types";

import { CvFontFaces, CvThumbnail } from "./cv-html-preview";
import { TemplateGrid } from "./cv-style-panel";

/** Silhouette neutre pour la photo des miniatures. */
const SAMPLE_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#cbd5e1"/><circle cx="50" cy="38" r="18" fill="#f1f5f9"/><ellipse cx="50" cy="92" rx="32" ry="26" fill="#f1f5f9"/></svg>',
)}`;

/** CV d'exemple des miniatures (fictif). */
const SAMPLE_DATA = CvDataSchema.parse({
  personal: {
    firstName: "Camille",
    lastName: "Durand",
    jobTitle: "Chargée de marketing digital",
    email: "camille.durand@email.fr",
    phone: "06 12 34 56 78",
    city: "Lyon",
    linkedin: "linkedin.com/in/camille-durand",
    github: "github.com/cdurand",
  },
  summary:
    "4 ans d'expérience en acquisition et en contenu. J'aime piloter des campagnes mesurables et travailler avec les équipes produit.",
  experiences: [
    {
      id: "a",
      position: "Chargée de marketing digital",
      company: "Back Market",
      startDate: "09/2022",
      current: true,
      location: "Paris",
      bullets: [
        "Lancé 12 campagnes d'acquisition, +35 % de leads qualifiés",
        "Piloté un budget média de 200 k€ par an",
        "Coordonné une équipe de 3 freelances",
      ],
    },
    {
      id: "b",
      position: "Assistante marketing",
      company: "Lydia",
      startDate: "01/2020",
      endDate: "08/2022",
      location: "Paris",
      bullets: ["Rédigé la newsletter mensuelle (60 000 abonnés)", "Animé les réseaux sociaux de la marque"],
    },
  ],
  education: [
    { id: "e", school: "IAE Lyon", degree: "Master Marketing digital", startDate: "2018", endDate: "2020", honors: "Mention bien" },
  ],
  skills: [
    { id: "1", name: "Google Ads", level: "expert" },
    { id: "2", name: "SEO", level: "avance" },
    { id: "3", name: "Figma", level: "intermediaire" },
    { id: "4", name: "Rédaction", level: "avance" },
  ],
  languages: [
    { id: "l", name: "Français", level: "Langue maternelle" },
    { id: "m", name: "Anglais", level: "Courant (C1)" },
  ],
  interests: "Course à pied, photographie",
});

// Photo hors du schéma (SVG, jamais enregistrée) : affichée seulement par les miniatures.
const SAMPLE: CvData = { ...SAMPLE_DATA, personal: { ...SAMPLE_DATA.personal, photo: SAMPLE_PHOTO } };

function SubmitButton({ children, className }: { children: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Création du CV…" : children}
    </button>
  );
}

/**
 * Fenêtre « Choisis un modèle » : miniatures des 5 modèles, sélection, puis les boutons
 * de `footer` (qui reçoit le modèle sélectionné). Ouverte avec `dialogRef.current.showModal()`.
 */
export function TemplateChoiceDialog({
  dialogRef,
  open,
  onClose,
  subtitle = "Il s'applique à tout ton CV.",
  footer,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** Contenu rendu seulement pendant l'ouverture (miniatures). */
  open: boolean;
  onClose: () => void;
  subtitle?: string;
  footer: (selected: CvTemplateId) => ReactNode;
}) {
  const [selected, setSelected] = useState<CvTemplateId>("minimaliste");
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // Clic sur le fond assombri : fermeture.
      onClick={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.close();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900"
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <CvFontFaces />
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div>
              <h2 id={titleId} className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Choisis un modèle
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div role="radiogroup" aria-label="Modèles de CV" className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
            {CV_TEMPLATES.map((t) => {
              const active = t.id === selected;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(t.id)}
                  className={`flex flex-col items-center gap-3 rounded-2xl p-3 text-left transition ${
                    active
                      ? "bg-blue-50 ring-2 ring-blue-600 dark:bg-blue-500/15 dark:ring-blue-400"
                      : "ring-1 ring-slate-200 hover:ring-slate-300 dark:ring-slate-700 dark:hover:ring-slate-500"
                  }`}
                >
                  <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                    <CvThumbnail data={SAMPLE} templateId={t.id} width={220} />
                  </div>
                  <span className="w-full">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{t.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col-reverse items-center gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-between dark:border-slate-700">
            {footer(selected)}
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Poste visé : saisi à l'étape 1 de « Créer un CV depuis zéro ». */
const TARGET_JOB_MIN = 2;
const TARGET_JOB_MAX = 120;

/**
 * « Créer un CV depuis zéro », en deux étapes : poste visé (secteur du score et du coach, aussi
 * titre du CV), puis modèle ; le CV vide est créé et l'éditeur s'ouvre.
 */
export function NewCvDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [targetJob, setTargetJob] = useState("");
  const [templateId, setTemplateId] = useState<CvTemplateId>("minimaliste");
  const titleId = useId();
  const jobId = useId();
  const jobReady = targetJob.trim().length >= TARGET_JOB_MIN;

  function open() {
    setStep(1);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className="btn-primary px-5 py-2.5 text-sm">
        Créer un CV depuis zéro
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Clic sur le fond assombri : fermeture.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900"
      >
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Étape {step} sur 2</p>
              <h2 id={titleId} className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {step === 1 ? "Quel poste visez-vous ?" : "Choisis un modèle"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (jobReady) setStep(2);
              }}
              className="space-y-5 p-6"
            >
              <div className="space-y-1.5">
                <label htmlFor={jobId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Poste visé
                </label>
                <input
                  id={jobId}
                  value={targetJob}
                  onChange={(e) => setTargetJob(e.target.value)}
                  maxLength={TARGET_JOB_MAX}
                  placeholder="Ex. Analyste financier, Développeur backend"
                  autoFocus
                  className="input w-full"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Il sert de titre à ton CV et adapte le score et le coach à ton secteur.
                </p>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={!jobReady} className="btn-primary px-6 py-2.5 text-sm">
                  Suivant
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <TemplateGrid selected={templateId} onSelect={setTemplateId} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary px-5 py-2.5 text-sm">
                  Retour
                </button>
                <form action={createBuilderCvAction.bind(null, templateId)}>
                  <input type="hidden" name="targetJob" value={targetJob.trim()} />
                  <SubmitButton className="btn-primary px-6 py-2.5 text-sm">Créer mon CV</SubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
