"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addProfileCvAction,
  deleteProfileCvAction,
  renameProfileCvAction,
  type ProfileActionResult,
} from "@/app/actions/profile";
import {
  CV_MAX_BYTES,
  CV_MAX_LABEL,
  CV_NAME_MAX_LENGTH,
  PROFILE_CV_LIMIT,
  type ProfileCv,
} from "@/lib/cv-types";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const inputClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none";
const smallButton =
  "rounded-lg px-3 py-1.5 text-sm font-medium ring-1 disabled:cursor-not-allowed disabled:opacity-50";

/** Nom proposé par défaut à partir du nom de fichier : "cv_data-2026.pdf" → "cv data 2026". */
function nameFromFile(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, CV_NAME_MAX_LENGTH);
}

function CvRow({
  cv,
  busy,
  onAction,
}: {
  cv: ProfileCv;
  busy: boolean;
  onAction: (task: () => Promise<ProfileActionResult>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cv.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-600">
            PDF
          </span>
          {editing ? (
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onAction(() => renameProfileCvAction(cv.id, name));
                setEditing(false);
              }}
            >
              <label htmlFor={`name-${cv.id}`} className="sr-only">
                Nom du CV
              </label>
              <input
                id={`name-${cv.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={CV_NAME_MAX_LENGTH}
                autoFocus
                className={inputClassName}
              />
              <button type="submit" disabled={busy || !name.trim()} className={`${smallButton} bg-indigo-600 text-white ring-indigo-600`}>
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(cv.name);
                }}
                className={`${smallButton} text-slate-700 ring-slate-300`}
              >
                Annuler
              </button>
            </form>
          ) : (
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{cv.name}</p>
              <p className="truncate text-xs text-slate-500">
                {cv.fileName} · ajouté le {dateFormatter.format(new Date(cv.uploadedAt))}
              </p>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-2">
            <a href={`/profil/cv/${cv.id}`} target="_blank" rel="noopener" className={`${smallButton} text-indigo-600 ring-indigo-200 hover:bg-indigo-50`}>
              Voir
            </a>
            <a href={`/profil/cv/${cv.id}?telecharger=1`} className={`${smallButton} text-slate-700 ring-slate-300 hover:bg-slate-50`}>
              Télécharger
            </a>
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${smallButton} text-slate-700 ring-slate-300 hover:bg-slate-50`}>
              Renommer
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-rose-700">Supprimer ?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(() => deleteProfileCvAction(cv.id))}
                  className={`${smallButton} bg-rose-600 text-white ring-rose-600`}
                >
                  Oui, supprimer
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={`${smallButton} text-slate-700 ring-slate-300`}>
                  Non
                </button>
              </span>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className={`${smallButton} text-rose-700 ring-rose-200 hover:bg-rose-50`}>
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function ProfileCvs({ cvs }: { cvs: ProfileCv[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [formKey, setFormKey] = useState(0); // réinitialise le champ fichier après un ajout

  const limitReached = cvs.length >= PROFILE_CV_LIMIT;

  function onAction(task: () => Promise<ProfileActionResult>, onSuccess?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      setFeedback(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {cvs.length} / {PROFILE_CV_LIMIT} CV enregistrés
      </p>

      {cvs.length > 0 && (
        <ul className="space-y-3">
          {cvs.map((cv) => (
            <CvRow key={`${cv.id}-${cv.name}`} cv={cv} busy={busy} onAction={onAction} />
          ))}
        </ul>
      )}

      {limitReached ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
          Tu as atteint la limite de {PROFILE_CV_LIMIT} CV. Supprimes-en un pour en ajouter un autre.
        </p>
      ) : (
        <form
          key={formKey}
          onSubmit={(e) => {
            e.preventDefault();
            if (!file || fileError || !newName.trim()) return;
            const formData = new FormData();
            formData.set("name", newName);
            formData.set("cv", file);
            onAction(() => addProfileCvAction(formData), () => {
              setFile(null);
              setNewName("");
              setFormKey((k) => k + 1);
            });
          }}
          className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
        >
          <p className="text-sm font-medium text-slate-700">Ajouter un CV</p>
          <div>
            <label htmlFor="new-cv-file" className="mb-1 block text-xs text-slate-500">
              Fichier PDF ({CV_MAX_LABEL} max)
            </label>
            <input
              id="new-cv-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (!selected) setFileError(null);
                else if (selected.type && selected.type !== "application/pdf") setFileError("Choisis un fichier PDF.");
                else if (selected.size > CV_MAX_BYTES) setFileError(`Ce fichier dépasse ${CV_MAX_LABEL}.`);
                else setFileError(null);
                if (selected && !newName.trim()) setNewName(nameFromFile(selected.name));
              }}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
            />
            {fileError && <p className="mt-1 text-sm text-rose-600">{fileError}</p>}
          </div>
          <div>
            <label htmlFor="new-cv-name" className="mb-1 block text-xs text-slate-500">
              Nom du CV
            </label>
            <input
              id="new-cv-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={CV_NAME_MAX_LENGTH}
              placeholder="Ex. CV Data, CV Marketing…"
              className={inputClassName}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !file || Boolean(fileError) || !newName.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Enregistrement…" : "Ajouter ce CV"}
          </button>
        </form>
      )}

      {feedback && !busy && (
        <p role={feedback.ok ? "status" : "alert"} className={`text-sm ${feedback.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
