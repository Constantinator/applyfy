"use client";

import { useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFormStatus } from "react-dom";

import { convertLegacyCvAction, createBuilderCvAction } from "@/app/actions/cv-builder";
import { CV_DEFAULT_TEMPLATE, CvDataSchema, type CvData, type CvTemplateId } from "@/lib/cv-builder-types";
import { LUMEO_TEXTS } from "@/lib/lumeo-texts";

import { CvFontFaces } from "./cv-html-preview";
import { TemplateGrid } from "./cv-style-panel";

/** CV vide : les vignettes le dessinent en barres grises (cf. thumbnailData). */
const EMPTY_CV: CvData = CvDataSchema.parse({});

function SubmitButton({ children, className }: { children: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Création du CV…" : children}
    </button>
  );
}

/**
 * Fenêtre « Choisis un modèle » : miniatures des modèles, sélection, puis les boutons
 * de `footer` (qui reçoit le modèle sélectionné). Ouverte avec `dialogRef.current.showModal()`.
 */
export function TemplateChoiceDialog({
  dialogRef,
  open,
  onClose,
  subtitle = "Il s'applique à tout ton CV.",
  data = EMPTY_CV,
  footer,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** Contenu rendu seulement pendant l'ouverture (miniatures). */
  open: boolean;
  onClose: () => void;
  subtitle?: string;
  /** CV montré dans les vignettes. */
  data?: CvData;
  footer: (selected: CvTemplateId) => ReactNode;
}) {
  const [selected, setSelected] = useState<CvTemplateId>(CV_DEFAULT_TEMPLATE);
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
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl rounded-card bg-white p-0 backdrop:bg-slate-900/60 dark:bg-slate-900"
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <CvFontFaces />
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4 dark:border-slate-700">
            <div>
              <h2 id={titleId} className="text-xl font-bold tracking-title text-ink dark:text-white">
                Choisis un modèle
              </h2>
              <p className="mt-0.5 text-sm text-muted dark:text-slate-400">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="rounded-block p-1.5 text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <TemplateGrid selected={selected} data={data} onSelect={setSelected} />
          </div>

          <div className="flex flex-col-reverse items-center gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-between dark:border-slate-700">
            {footer(selected)}
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Prévient qu'un nouveau CV prendra la place de celui déjà lié à la candidature. */
export function CvReplacementNotice({ title, className = "" }: { title: string; className?: string }) {
  return (
    <p className={`text-sm font-semibold text-ink dark:text-slate-200 ${className}`}>
      Ce CV remplacera « {title} » pour cette offre. L&apos;ancien CV restera dans ta bibliothèque.
    </p>
  );
}

/** Poste visé : saisi à l'étape 1 de « Créer un CV depuis zéro ». */
const TARGET_JOB_MIN = 2;
const TARGET_JOB_MAX = 120;

/**
 * « Créer un CV depuis zéro », en deux étapes : poste visé (secteur du score et du coach, aussi
 * titre du CV), puis modèle ; le CV vide est créé et l'éditeur s'ouvre. `application` : CV lié à
 * cette candidature, dont le poste évite la première étape, et ancien CV de la candidature proposé.
 */
export function NewCvDialog({
  application = null,
}: {
  /** `linkedCvTitle` : nom du CV déjà lié, que le nouveau CV remplacera pour cette candidature. */
  application?: { id: string; position: string; hasLegacyCv: boolean; linkedCvTitle: string | null } | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const position = (application?.position ?? "").trim().slice(0, TARGET_JOB_MAX);
  // Le poste vient de la candidature : pas de question, sauf s'il est inutilisable.
  const jobKnown = position.length >= TARGET_JOB_MIN;
  const firstStep = jobKnown ? 2 : 1;
  const [step, setStep] = useState<1 | 2>(firstStep);
  const [targetJob, setTargetJob] = useState(position);
  const [templateId, setTemplateId] = useState<CvTemplateId>(CV_DEFAULT_TEMPLATE);
  const titleId = useId();
  const jobId = useId();
  const jobReady = targetJob.trim().length >= TARGET_JOB_MIN;

  function open() {
    setStep(firstStep);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className="ui-btn-primary">
        {application ? "Créer un CV à partir de zéro" : "Créer un CV depuis zéro"}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Clic sur le fond assombri : fermeture.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl rounded-card bg-white p-0 backdrop:bg-slate-900/60 dark:bg-slate-900"
      >
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4 dark:border-slate-700">
            <div>
              {!jobKnown && <p className="text-xs font-medium text-muted dark:text-slate-400">Étape {step} sur 2</p>}
              <h2 id={titleId} className="text-xl font-bold tracking-title text-ink dark:text-white">
                {step === 1 ? "Quel poste visez-vous ?" : "Choisis un modèle"}
              </h2>
              {application?.linkedCvTitle && <CvReplacementNotice title={application.linkedCvTitle} className="mt-1" />}
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fermer"
              className="rounded-block p-1.5 text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
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
                <label htmlFor={jobId} className="text-sm font-medium text-ink dark:text-slate-200">
                  Poste visé
                </label>
                <input
                  id={jobId}
                  value={targetJob}
                  onChange={(e) => setTargetJob(e.target.value)}
                  maxLength={TARGET_JOB_MAX}
                  placeholder="Ex. Analyste financier, Développeur backend"
                  autoFocus
                  className="ui-input w-full"
                />
                <p className="text-xs text-muted dark:text-slate-400">
                  {LUMEO_TEXTS.targetJobHelp}
                </p>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={!jobReady} className="ui-btn-primary">
                  Suivant
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <TemplateGrid selected={templateId} data={EMPTY_CV} onSelect={setTemplateId} />
              </div>
              {application?.hasLegacyCv && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 dark:border-slate-700">
                  <p className="min-w-0 flex-1 basis-64 text-xs text-muted dark:text-slate-400">
                    Ton ancien CV est converti une seule fois, sans décompte. Cela peut prendre jusqu&apos;à une minute.
                  </p>
                  <form action={convertLegacyCvAction}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <SubmitButton className="ui-btn-secondary">Reprendre mon ancien CV</SubmitButton>
                  </form>
                </div>
              )}
              <div className={`flex items-center gap-3 border-t border-line px-6 py-4 dark:border-slate-700 ${jobKnown ? "justify-end" : "justify-between"}`}>
                {!jobKnown && (
                  <button type="button" onClick={() => setStep(1)} className="ui-btn-secondary">
                    Retour
                  </button>
                )}
                <form action={createBuilderCvAction.bind(null, templateId)}>
                  <input type="hidden" name="targetJob" value={targetJob.trim()} />
                  {application && <input type="hidden" name="applicationId" value={application.id} />}
                  <SubmitButton className="ui-btn-primary">Créer mon CV</SubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
