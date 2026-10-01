"use client";

import { useRef, useState, useTransition } from "react";

import { deleteAccountAction } from "@/app/actions/auth";

/** Bouton « Supprimer mon compte » et sa fenêtre de confirmation. */
export function DeleteAccount() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDeletion() {
    setError(null);
    startTransition(async () => {
      // En cas de succès, l'action redirige vers la page d'accueil.
      const result = await deleteAccountAction();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-red-500/30 focus-visible:outline-none"
      >
        Supprimer mon compte
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        // Pas de fermeture par Échap pendant la suppression.
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/50"
      >
        <div className="space-y-4 p-6">
          <h2 id="delete-account-title" className="text-lg font-semibold text-slate-900">
            Es-tu sûr ?
          </h2>
          <p id="delete-account-description" className="text-sm text-slate-600">
            Cette action est irréversible et supprimera toutes tes candidatures, CV et données.
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
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
              type="button"
              onClick={confirmDeletion}
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-60"
            >
              {pending ? "Suppression…" : "Oui, supprimer mon compte"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
