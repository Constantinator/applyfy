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
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

/** « Supprimer » un CV du CV Builder, avec confirmation. */
export function DeleteBuilderCvButton({ id, title }: { id: string; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/15"
      >
        Supprimer
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/50 dark:bg-slate-900"
      >
        <form action={deleteBuilderCvAction.bind(null, id)} className="space-y-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
            Supprimer « {title} » ?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Ce CV sera supprimé définitivement.</p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="btn-secondary px-4 py-2 text-sm">
              Annuler
            </button>
            <ConfirmButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
