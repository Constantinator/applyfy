"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { deleteBuilderCvAction } from "@/app/actions/cv-builder";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-btn-danger"
    >
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

/** « Supprimer » un CV du CV Builder, avec confirmation. `applicationId` : page de la candidature à retrouver ensuite. */
export function DeleteBuilderCvButton({ id, title, applicationId }: { id: string; title: string; applicationId?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="ui-btn-danger"
      >
        Supprimer
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card p-0 backdrop:bg-slate-900/50 dark:bg-slate-900"
      >
        <form action={deleteBuilderCvAction.bind(null, id)} className="space-y-4 p-6">
          {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
          <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
            Supprimer « {title} » ?
          </h2>
          <p className="text-sm text-muted dark:text-slate-300">Ce CV sera supprimé définitivement.</p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="ui-btn-secondary">
              Annuler
            </button>
            <ConfirmButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
