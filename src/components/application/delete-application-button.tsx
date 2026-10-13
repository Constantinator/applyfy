"use client";

import { useActionState, useRef } from "react";

import { deleteApplicationAction, type ActionState } from "@/app/actions/applications";

const initialState: ActionState = { status: "idle" };

export function DeleteApplicationButton({
  applicationId,
  company,
}: {
  applicationId: string;
  company: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteApplicationAction, initialState);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 ring-1 ring-red-300 hover:bg-red-50"
      >
        Supprimer la candidature
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/50"
      >
        <form action={formAction} className="space-y-4 p-6">
          <input type="hidden" name="id" value={applicationId} />
          <h2 id="delete-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Supprimer la candidature {company} ?
          </h2>
          <p id="delete-description" className="text-sm text-slate-600 dark:text-slate-300">
            Es-tu sûr de vouloir supprimer cette candidature ? Cette action est irréversible.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            L&apos;historique, le résumé et les documents associés seront aussi supprimés.
          </p>
          {state.status === "error" && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30"
            >
              {state.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-60"
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
