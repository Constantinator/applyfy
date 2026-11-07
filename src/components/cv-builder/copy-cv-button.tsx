"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { copyCvForOfferAction } from "@/app/actions/cv-builder";

import { CvReplacementNotice } from "./new-cv-dialog";

function SubmitButton({ className, children }: { className: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Copie du CV…" : children}
    </button>
  );
}

/**
 * « Utiliser pour cette offre » : copie ce CV pour la candidature (cf. copyCvForOfferAction). Si un CV y
 * est déjà lié (`replacedTitle`), une confirmation prévient qu'il sera remplacé.
 */
export function CopyCvForOfferButton({
  cvId,
  applicationId,
  replacedTitle,
}: {
  cvId: string;
  applicationId: string;
  replacedTitle: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const fields = (
    <>
      <input type="hidden" name="cvId" value={cvId} />
      <input type="hidden" name="applicationId" value={applicationId} />
    </>
  );

  if (!replacedTitle) {
    return (
      <form action={copyCvForOfferAction}>
        {fields}
        <SubmitButton className="ui-btn-secondary">Utiliser pour cette offre</SubmitButton>
      </form>
    );
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="ui-btn-secondary">
        Utiliser pour cette offre
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card p-0 backdrop:bg-slate-900/50 dark:bg-slate-900"
      >
        <form action={copyCvForOfferAction} className="space-y-4 p-6">
          {fields}
          <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
            Utiliser ce CV pour cette offre ?
          </h2>
          <p className="text-sm text-muted dark:text-slate-300">Une copie sera créée : ce CV ne sera pas modifié.</p>
          <CvReplacementNotice title={replacedTitle} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="ui-btn-secondary">
              Annuler
            </button>
            <SubmitButton className="ui-btn-primary">Créer la copie</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
