"use client";

import { startTransition, useActionState, useState } from "react";

import {
  deleteProfileCvAction,
  uploadProfileCvAction,
  type ProfileCvState,
} from "@/app/actions/profile";
import { CV_MAX_BYTES, CV_MAX_LABEL } from "@/lib/cv-types";

const initialState: ProfileCvState = { status: "idle" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function ProfileCvForm({ cv }: { cv: { fileName: string; uploadedAt: string } | null }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadProfileCvAction, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteProfileCvAction, initialState);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [lastAction, setLastAction] = useState<"upload" | "delete" | null>(null);
  // État de l'envoi au moment où « Remplacer » a été cliqué : le formulaire se referme
  // dès qu'un nouvel envoi réussit (l'état change), reste ouvert en cas d'erreur.
  const [replacingAt, setReplacingAt] = useState<ProfileCvState | null>(null);

  const lastState = lastAction === "delete" ? deleteState : uploadState;
  const replacing =
    replacingAt !== null &&
    (uploading || uploadState === replacingAt || uploadState.status === "error");
  const showUpload = !cv || replacing;

  return (
    <div className="space-y-4">
      {cv && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-600">
              PDF
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{cv.fileName}</p>
              <p className="text-xs text-slate-500">
                Ajouté le {dateFormatter.format(new Date(cv.uploadedAt))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/profil/cv"
              target="_blank"
              rel="noopener"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
            >
              Voir
            </a>
            <button
              type="button"
              onClick={() => setReplacingAt(replacing ? null : uploadState)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              {replacing ? "Annuler" : "Remplacer"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setLastAction("delete");
                setReplacingAt(null);
                startTransition(() => deleteAction());
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      {showUpload && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!hasFile || fileError) return;
            const formData = new FormData(e.currentTarget);
            setLastAction("upload");
            startTransition(() => uploadAction(formData));
          }}
          className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
        >
          <label htmlFor="cv" className="block text-sm font-medium text-slate-700">
            {cv ? "Nouveau CV" : "Ton CV"} (PDF, {CV_MAX_LABEL} max)
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept="application/pdf,.pdf"
            required
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setHasFile(Boolean(file));
              if (!file) setFileError(null);
              else if (file.type && file.type !== "application/pdf") setFileError("Choisis un fichier PDF.");
              else if (file.size > CV_MAX_BYTES) setFileError(`Ce fichier dépasse ${CV_MAX_LABEL}.`);
              else setFileError(null);
            }}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
          />
          {fileError && <p className="text-sm text-rose-600">{fileError}</p>}
          <button
            type="submit"
            disabled={uploading || !hasFile || Boolean(fileError)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {uploading ? "Envoi…" : "Enregistrer mon CV"}
          </button>
        </form>
      )}

      {lastState.status !== "idle" && !uploading && !deleting && (
        <p
          role={lastState.status === "error" ? "alert" : "status"}
          className={`text-sm ${lastState.status === "error" ? "text-rose-600" : "text-emerald-700"}`}
        >
          {lastState.message}
        </p>
      )}
    </div>
  );
}
