"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";

import { importCoverLetterAction, type GenerateCoverLetterState } from "@/app/actions/cover-letter";
import { openCvEditorAction, type OpenCvEditorState } from "@/app/actions/cv";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { CV_MAX_BYTES, CV_MAX_LABEL, type ProfileCv } from "@/lib/cv-types";

// Fenêtres « Ouvrir l'éditeur de CV » et « Ouvrir l'éditeur de lettre » de la fiche
// candidature : choix du point de départ, puis ouverture de l'éditeur.

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
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
        selected ? "bg-blue-50/60 ring-2 ring-blue-500" : "bg-white ring-slate-200"
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
          <span className="block text-sm font-medium text-slate-900">{title}</span>
          <span className="block text-xs text-slate-500">{description}</span>
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
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
      />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-0 shadow-2xl shadow-slate-900/20 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
  hasCv,
  aiEnabled,
  limitReached,
  resetLabel,
  className,
}: {
  applicationId: string;
  profileCvs: ProfileCv[];
  /** Un CV est déjà ouvert dans l'éditeur pour cette candidature. */
  hasCv: boolean;
  aiEnabled: boolean;
  /** Limite mensuelle des CV importés atteinte. */
  limitReached: boolean;
  resetLabel: string;
  className: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(openCvEditorAction, initialCvState);
  const [source, setSource] = useState<string>(hasCv ? "actuel" : profileCvs.length ? "profil" : "upload");
  const [cvId, setCvId] = useState(profileCvs[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const fileError = pdfError(file);

  const ready =
    source === "actuel" ||
    source === "vierge" ||
    (source === "profil" && Boolean(cvId)) ||
    (source === "upload" && Boolean(file) && !fileError);
  const limitHit = limitReached || (state.status === "error" && state.limitReached === true);

  function submit() {
    if (!ready || pending) return;
    const formData = new FormData();
    formData.set("id", applicationId);
    formData.set("source", source);
    if (source === "profil") formData.set("cvId", cvId);
    if (source === "upload" && file) formData.set("cv", file);
    startTransition(() => action(formData));
  }

  const replaceNote = hasCv ? " Remplace le CV en cours." : "";

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={className}>
        Ouvrir l&apos;éditeur de CV
      </button>
      <Dialog dialogRef={dialogRef} titleId="cv-editor-title" title="Ouvrir l'éditeur de CV">
        <fieldset className="space-y-2" disabled={pending}>
          <legend className="mb-1 text-sm text-slate-600">Avec quel CV commencer ?</legend>
          {hasCv && (
            <Option
              name="cv-start"
              value="actuel"
              selected={source === "actuel"}
              onSelect={setSource}
              title="Reprendre mon CV en cours"
              description="Le CV déjà ouvert pour cette candidature, avec tes modifications."
            />
          )}
          <Option
            name="cv-start"
            value="upload"
            selected={source === "upload"}
            onSelect={setSource}
            disabled={!aiEnabled || limitHit}
            title="Importer un CV depuis mon ordinateur"
            description={`Ton CV au format PDF est repris tel quel dans l'éditeur.${replaceNote}`}
          >
            <FileField
              id="cv-editor-file"
              accept="application/pdf,.pdf"
              hint={`PDF, ${CV_MAX_LABEL} max.`}
              onChange={setFile}
              error={fileError}
            />
          </Option>
          <Option
            name="cv-start"
            value="profil"
            selected={source === "profil"}
            onSelect={setSource}
            disabled={profileCvs.length === 0 || !aiEnabled}
            title="Utiliser un CV de mon profil"
            description={
              profileCvs.length === 0
                ? "Aucun CV enregistré dans Mon profil pour l'instant."
                : `Un des CV enregistrés dans Mon profil.${replaceNote}`
            }
          >
            <div className="space-y-1.5">
              {profileCvs.map((cv) => (
                <label key={cv.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="cv-profile"
                    checked={cvId === cv.id}
                    onChange={() => setCvId(cv.id)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span>
                    {cv.name} <span className="text-slate-500">({cv.fileName})</span>
                  </span>
                </label>
              ))}
            </div>
          </Option>
          <Option
            name="cv-start"
            value="vierge"
            selected={source === "vierge"}
            onSelect={setSource}
            title="Commencer avec un CV vierge"
            description={`La structure habituelle, avec des exemples à remplacer.${replaceNote}`}
          />
        </fieldset>

        {profileCvs.length === 0 && (
          <p className="text-xs text-slate-500">
            Astuce : enregistre ton CV dans{" "}
            <Link href="/profil" className="font-medium text-blue-700 underline underline-offset-2">
              Mon profil
            </Link>{" "}
            pour le réutiliser sur toutes tes candidatures.
          </p>
        )}
        {limitHit && <UsageLimitBanner resetLabel={resetLabel} />}

        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner />
            {source === "upload" || source === "profil"
              ? "Préparation de ton CV dans l'éditeur… cela peut prendre jusqu'à une minute."
              : "Ouverture de l'éditeur…"}
          </p>
        )}
        {state.status === "error" && !state.limitReached && !pending && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
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
          <legend className="mb-1 text-sm text-slate-600">Comment commencer ta lettre ?</legend>
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
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner />
            Import de ta lettre… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
        {state.status === "error" && !state.limitReached && !pending && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
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
