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
        className="ui-btn-danger"
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
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card p-0 backdrop:bg-slate-900/50"
      >
        <div className="space-y-4 p-6">
          <h2 id="delete-account-title" className="ui-title-sm">
            Es-tu sûr ?
          </h2>
          <p id="delete-account-description" className="text-sm text-muted dark:text-slate-300">
            Cette action est irréversible et supprimera toutes tes candidatures, CV et données.
          </p>
          {error && (
            <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
              className="ui-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmDeletion}
              disabled={pending}
              className="ui-btn-danger"
            >
              {pending ? "Suppression…" : "Oui, supprimer mon compte"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
