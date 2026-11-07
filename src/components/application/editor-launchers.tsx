"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";

import { importCoverLetterAction, type GenerateCoverLetterState } from "@/app/actions/cover-letter";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { CV_MAX_BYTES, CV_MAX_LABEL } from "@/lib/cv-types";

// Fenêtre « Ouvrir l'éditeur de lettre » de la fiche candidature : choix du point de départ, puis
// ouverture de l'éditeur.

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong dark:border-slate-700 border-t-blue-600"
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
      className={`rounded-block p-3 ring-1 transition ${
        selected ? "bg-pill ring-2 ring-accent" : "bg-white dark:bg-slate-900 ring-line dark:ring-slate-700"
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
          className="mt-1 accent-accent"
        />
        <span>
          <span className="block text-sm font-medium text-ink dark:text-white">{title}</span>
          <span className="block text-xs text-muted dark:text-slate-400">{description}</span>
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
        className="block w-full text-sm text-ink dark:text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink file:ring-1 file:ring-line-strong hover:file:bg-surface"
      />
      <p className="mt-1 text-xs text-muted dark:text-slate-400">{hint}</p>
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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card bg-white dark:bg-slate-900 p-0 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line dark:border-slate-800 px-6 py-5">
        <h2 id={titleId} className="text-lg font-bold tracking-title text-ink dark:text-white">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fermer"
          className="rounded-block p-1.5 text-muted hover:bg-pill dark:hover:bg-slate-800 hover:text-ink dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </dialog>
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
          <legend className="mb-1 text-sm text-muted dark:text-slate-300">Comment commencer ta lettre ?</legend>
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
          <p role="status" className="flex items-center gap-2 text-sm text-muted dark:text-slate-400">
            <Spinner />
            Import de ta lettre… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
        {state.status === "error" && !state.limitReached && !pending && (
          <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={!ready || busy} className="ui-btn-primary">
            {busy ? "Ouverture…" : "Ouvrir l'éditeur"}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className="ui-btn-secondary"
          >
            Annuler
          </button>
        </div>
      </Dialog>
    </>
  );
}
