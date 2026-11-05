"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useId, useRef, useState } from "react";

import { importCoverLetterAction, type GenerateCoverLetterState } from "@/app/actions/cover-letter";
import { openCvEditorAction, type OpenCvEditorState } from "@/app/actions/cv";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import type { BuilderCvChoice } from "@/lib/cv-builder-types";
import { CV_MAX_BYTES, CV_MAX_LABEL, type ProfileCv } from "@/lib/cv-types";

// Fenêtres « Adapter mon CV à l'offre » et « Ouvrir l'éditeur de lettre » de la fiche
// candidature : choix du point de départ, puis ouverture de l'éditeur.

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-blue-600"
    />
  );
}

/** Option de départ : carte cliquable (bouton radio), détail affiché une fois choisie. */
function Option({
  name,
  value,
  selected,
  onSelect,
  title,
  description,
  disabled = false,
  children,
}: {
  name: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
  title: string;
  description: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl p-3 ring-1 transition ${
        selected ? "bg-blue-50/60 ring-2 ring-blue-500" : "bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-700"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="radio"
          name={name}
          value={value}
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect(value)}
          className="mt-1 accent-blue-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900 dark:text-white">{title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </span>
      </label>
      {selected && children && <div className="mt-3 pl-7">{children}</div>}
    </div>
  );
}

/** Champ de fichier commun (PDF, ou PDF et Word). */
function FileField({
  id,
  accept,
  hint,
  onChange,
  error,
}: {
  id: string;
  accept: string;
  hint: string;
  onChange: (file: File | null) => void;
  error: string | null;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Fichier
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Fenêtre modale native : focus piégé, Échap, arrière-plan inerte. */
function Dialog({
  dialogRef,
  titleId,
  title,
  onClose,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleId: string;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-0 shadow-2xl shadow-slate-900/20 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </dialog>
  );
}

const pdfError = (file: File | null) =>
  !file
    ? null
    : file.type && file.type !== "application/pdf"
      ? "Choisis un fichier PDF."
      : file.size > CV_MAX_BYTES
        ? `Ce fichier dépasse ${CV_MAX_LABEL}.`
        : null;

// ---------------------------------------------------------------------------
// Éditeur de CV
// ---------------------------------------------------------------------------

const initialCvState: OpenCvEditorState = { status: "idle" };

export function CvEditorLauncher({
  applicationId,
  profileCvs,
  builderCvs,
  linkedCvId,
  hasLegacyCv,
  aiEnabled,
  limitReached,
  resetLabel,
  className,
}: {
  applicationId: string;
  profileCvs: ProfileCv[];
  /** CV du CV Builder de l'utilisateur. */
  builderCvs: BuilderCvChoice[];
  /** CV du CV Builder lié à cette candidature. */
  linkedCvId: string | null;
  /** CV de l'ancien éditeur, ouvert pour cette candidature (converti à sa reprise). */
  hasLegacyCv: boolean;
  aiEnabled: boolean;
  /** Limite mensuelle des CV importés atteinte. */
  limitReached: boolean;
  resetLabel: string;
  className: string;
}) {
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(openCvEditorAction, initialCvState);

  // « Reprendre un CV existant » : le CV de cette candidature d'abord, puis les autres.
  const linkedCv = builderCvs.find((cv) => cv.id === linkedCvId);
  const otherBuilderCvs = builderCvs.filter((cv) => cv.id !== linkedCvId);
  const legacy = hasLegacyCv && !linkedCv;
  const firstChoice = linkedCv
    ? `builder:${linkedCv.id}`
    : legacy && aiEnabled
      ? "actuel:"
      : otherBuilderCvs[0]
        ? `builder:${otherBuilderCvs[0].id}`
        : profileCvs[0] && aiEnabled
          ? `profil:${profileCvs[0].id}`
          : "";
  const [choice, setChoice] = useState(firstChoice);
  const [source, setSource] = useState<string>(firstChoice ? "existant" : "vierge");
  const [file, setFile] = useState<File | null>(null);
  const fileError = pdfError(file);

  const ready =
    source === "vierge" || (source === "existant" && Boolean(choice)) || (source === "upload" && Boolean(file) && !fileError);
  const limitHit = limitReached || (state.status === "error" && state.limitReached === true);

  function submit() {
    if (!ready || pending) return;
    const formData = new FormData();
    formData.set("id", applicationId);
    if (source === "existant") {
      const [choiceSource, cvId] = choice.split(":");
      formData.set("source", choiceSource);
      formData.set("cvId", cvId);
    } else {
      formData.set("source", source);
      if (source === "upload" && file) formData.set("cv", file);
    }
    startTransition(() => action(formData));
  }

  const replaceNote = linkedCv || legacy ? " Ton CV en cours reste dans le CV Builder." : "";
  const startName = `${uid}-cv-start`;
  const choiceRow = (value: string, label: React.ReactNode, disabled = false) => (
    <label
      key={value}
      className={`flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name={`${uid}-cv-choice`}
        checked={choice === value}
        disabled={disabled}
        onChange={() => setChoice(value)}
        className="mt-0.5 accent-blue-600"
      />
      <span>{label}</span>
    </label>
  );

  const hasExisting = builderCvs.length > 0 || legacy || profileCvs.length > 0;

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={className}>
        Adapter mon CV à l&apos;offre
      </button>
      <Dialog dialogRef={dialogRef} titleId={`${uid}-title`} title="Adapter mon CV à l'offre">
        <fieldset className="space-y-2" disabled={pending}>
          <legend className="mb-1 text-sm text-slate-600 dark:text-slate-300">Avec quel CV commencer ?</legend>
          <Option
            name={startName}
            value="vierge"
            selected={source === "vierge"}
            onSelect={setSource}
            title="Commencer d'un CV vierge"
            description={`Un CV à remplir, déjà réglé sur le poste de cette candidature.${replaceNote}`}
          />
          <Option
            name={startName}
            value="upload"
            selected={source === "upload"}
            onSelect={setSource}
            disabled={!aiEnabled || limitHit}
            title="Importer un CV depuis mon PC"
            description={`Ton CV au format PDF est repris tel quel dans l'éditeur.${replaceNote}`}
          >
            <FileField
              id={`${uid}-file`}
              accept="application/pdf,.pdf"
              hint={`PDF, ${CV_MAX_LABEL} max.`}
              onChange={setFile}
              error={fileError}
            />
          </Option>
          <Option
            name={startName}
            value="existant"
            selected={source === "existant"}
            onSelect={setSource}
            disabled={!hasExisting}
            title="Reprendre un CV existant"
            description={
              hasExisting
                ? "Un autre CV est copié pour cette candidature : l'original ne change pas."
                : "Aucun CV pour l'instant."
            }
          >
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {linkedCv && choiceRow(`builder:${linkedCv.id}`, `${linkedCv.title} (cette candidature)`)}
              {legacy && choiceRow("actuel:", "Mon CV en cours pour cette candidature", !aiEnabled)}
              {otherBuilderCvs.map((cv) => choiceRow(`builder:${cv.id}`, cv.title))}
              {profileCvs.map((cv) =>
                choiceRow(
                  `profil:${cv.id}`,
                  <>
                    {cv.name} <span className="text-slate-500 dark:text-slate-400">({cv.fileName})</span>
                  </>,
                  !aiEnabled,
                ),
              )}
            </div>
          </Option>
        </fieldset>

        {profileCvs.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Astuce : enregistre ton CV dans{" "}
            <Link href="/profil" className="font-medium text-blue-700 dark:text-blue-300 underline underline-offset-2">
              Mon profil
            </Link>{" "}
            pour le réutiliser sur toutes tes candidatures.
          </p>
        )}
        {limitHit && <UsageLimitBanner resetLabel={resetLabel} />}

        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner />
            Préparation de ton CV dans l&apos;éditeur… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
        {state.status === "error" && !state.limitReached && !pending && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={!ready || pending} className="btn-primary px-4 py-2 text-sm">
            {pending ? "Ouverture…" : "Ouvrir l'éditeur"}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Annuler
          </button>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Éditeur de lettre
// ---------------------------------------------------------------------------

const initialLetterState: GenerateCoverLetterState = { status: "idle" };

const letterFileError = (file: File | null) => {
  if (!file) return null;
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return "Choisis un fichier PDF ou Word (.docx).";
  return file.size > CV_MAX_BYTES ? `Ce fichier dépasse ${CV_MAX_LABEL}.` : null;
};

export function LetterEditorLauncher({
  applicationId,
  hasLetter,
  hasCv,
  aiEnabled,
  limitReached,
  resetLabel,
  className,
}: {
  applicationId: string;
  hasLetter: boolean;
  /** Un CV est disponible pour la rédaction (CV de la candidature ou CV du profil importé). */
  hasCv: boolean;
  aiEnabled: boolean;
  /** Limite mensuelle des lettres atteinte (import). */
  limitReached: boolean;
  resetLabel: string;
  className: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(importCoverLetterAction, initialLetterState);
  const [source, setSource] = useState<string>(hasLetter ? "actuelle" : "vierge");
  const [file, setFile] = useState<File | null>(null);
  const [navigating, setNavigating] = useState(false);
  const fileError = letterFileError(file);
  const limitHit = limitReached || (state.status === "error" && state.limitReached === true);
  const busy = pending || navigating;

  const ready = source !== "import" || (Boolean(file) && !fileError);

  function submit() {
    if (!ready || busy) return;
    if (source === "import") {
      const formData = new FormData();
      formData.set("id", applicationId);
      if (file) formData.set("lettre", file);
      startTransition(() => action(formData));
      return;
    }
    const base = `/candidatures/${applicationId}/lettre`;
    setNavigating(true);
    router.push(source === "actuelle" ? base : `${base}?depart=${source}`);
  }

  const replaceNote = hasLetter ? " Ta lettre en cours n'est remplacée que si tu enregistres." : "";

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={className}>
        Ouvrir l&apos;éditeur de lettre
      </button>
      <Dialog
        dialogRef={dialogRef}
        titleId="letter-editor-title"
        title="Ouvrir l'éditeur de lettre"
        onClose={() => setNavigating(false)}
      >
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="mb-1 text-sm text-slate-600 dark:text-slate-300">Comment commencer ta lettre ?</legend>
          {hasLetter && (
            <Option
              name="letter-start"
              value="actuelle"
              selected={source === "actuelle"}
              onSelect={setSource}
              title="Reprendre ma lettre en cours"
              description="La lettre déjà enregistrée pour cette candidature."
            />
          )}
          <Option
            name="letter-start"
            value="vierge"
            selected={source === "vierge"}
            onSelect={setSource}
            title="Commencer de zéro"
            description={`Le modèle de base : ton nom, l'objet et les formules de politesse.${replaceNote}`}
          />
          <Option
            name="letter-start"
            value="cv"
            selected={source === "cv"}
            onSelect={setSource}
            disabled={!hasCv || !aiEnabled}
            title="S'aider du CV en cours"
            description={
              hasCv
                ? `La lettre est rédigée à partir de ton CV et de l'offre, puis tu l'ajustes.${replaceNote}`
                : "Ouvre d'abord ton CV dans l'éditeur de CV pour t'en servir ici."
            }
          />
          <Option
            name="letter-start"
            value="import"
            selected={source === "import"}
            onSelect={setSource}
            disabled={!aiEnabled || limitHit}
            title="Importer une lettre existante"
            description={`Une ancienne lettre (PDF ou Word), reprise telle quelle dans l'éditeur.${
              hasLetter ? " Remplace la lettre en cours." : ""
            }`}
          >
            <FileField
              id="letter-editor-file"
              accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              hint={`PDF ou Word (.docx), ${CV_MAX_LABEL} max.`}
              onChange={setFile}
              error={fileError}
            />
          </Option>
        </fieldset>

        {limitHit && source === "import" && <UsageLimitBanner resetLabel={resetLabel} />}

        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner />
            Import de ta lettre… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
        {state.status === "error" && !state.limitReached && !pending && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={!ready || busy} className="btn-primary px-4 py-2 text-sm">
            {busy ? "Ouverture…" : "Ouvrir l'éditeur"}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Annuler
          </button>
        </div>
      </Dialog>
    </>
  );
}
