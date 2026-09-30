"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { generateCoverLetterAction, type GenerateCoverLetterState } from "@/app/actions/cover-letter";
import {
  CV_MAX_BYTES,
  CV_MAX_LABEL,
  PROFILE_SUMMARY_MAX,
  PROFILE_SUMMARY_MIN,
  type ProfileCv,
} from "@/lib/cv-types";

const initialState: GenerateCoverLetterState = { status: "idle" };

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Sources possibles du profil (sinon : id d'un CV du profil). */
const UPLOAD = "upload";
const RESUME = "resume";

export function CoverLetterGenerator({
  applicationId,
  hasOfferDescription,
  aiEnabled,
  profileCvs,
  letterSavedAt,
  hasLetter,
  signerName,
}: {
  applicationId: string;
  hasOfferDescription: boolean;
  aiEnabled: boolean;
  profileCvs: ProfileCv[];
  letterSavedAt: string | null;
  hasLetter: boolean;
  /** Prénom et nom du compte (signature de la lettre), null s'ils ne sont pas renseignés. */
  signerName: string | null;
}) {
  const [state, generate, generating] = useActionState(generateCoverLetterAction, initialState);
  const [source, setSource] = useState<string>(profileCvs[0]?.id ?? RESUME);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  // Avec une lettre existante, le choix du profil s'affiche à la demande (regénération).
  const [pickerOpen, setPickerOpen] = useState(!hasLetter);

  const selectedProfileCv = profileCvs.find((cv) => cv.id === source) ?? null;
  const sourceReady =
    source === UPLOAD
      ? Boolean(file) && !fileError
      : source === RESUME
        ? Boolean(signerName) && summary.trim().length >= PROFILE_SUMMARY_MIN
        : Boolean(selectedProfileCv);

  function run() {
    if (!sourceReady || generating) return;
    const formData = new FormData();
    formData.set("id", applicationId);
    if (source === UPLOAD) {
      formData.set("source", "upload");
      if (file) formData.set("cv", file);
    } else if (source === RESUME) {
      formData.set("source", "resume");
      formData.set("summary", summary);
    } else {
      formData.set("source", "profil");
      formData.set("cvId", source);
    }
    startTransition(() => generate(formData));
  }

  const radioClass = "flex cursor-pointer items-start gap-2.5 text-sm text-slate-700";
  const radio = (value: string, label: React.ReactNode) => (
    <label className={radioClass}>
      <input
        type="radio"
        name="letter-source"
        checked={source === value}
        onChange={() => setSource(value)}
        className="mt-0.5 accent-blue-600"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <section aria-labelledby="letter-title" className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="letter-title" className="font-semibold text-slate-900">
            Lettre de motivation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {hasLetter && letterSavedAt
              ? `Dernière modification le ${dateTimeFormatter.format(new Date(letterSavedAt))}.`
              : "L'assistant rédige une lettre personnalisée à partir de ton profil et de l'offre."}
          </p>
        </div>
        {hasLetter && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/candidatures/${applicationId}/lettre`} className="btn-primary px-4 py-2 text-sm">
              Ouvrir ma lettre →
            </Link>
            {!pickerOpen && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={!aiEnabled}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Regénérer
              </button>
            )}
          </div>
        )}
      </div>

      {!aiEnabled && (
        <p className="mt-3 text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      )}

      {pickerOpen && aiEnabled && (
        <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <fieldset className="space-y-2" disabled={generating}>
            <legend className="mb-1 text-sm font-medium text-slate-700">Sur quel profil s&apos;appuyer ?</legend>
            {profileCvs.map((cv) => (
              <div key={cv.id}>
                {radio(
                  cv.id,
                  <>
                    {cv.name} <span className="text-slate-500">({cv.fileName})</span>
                  </>,
                )}
              </div>
            ))}
            {radio(UPLOAD, "Importer un CV (PDF)")}
            {source === UPLOAD && (
              <div className="pl-6">
                <label htmlFor="letter-cv-file" className="sr-only">
                  CV au format PDF
                </label>
                <input
                  id="letter-cv-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    setFile(selected);
                    if (!selected) setFileError(null);
                    else if (selected.type && selected.type !== "application/pdf") setFileError("Choisis un fichier PDF.");
                    else if (selected.size > CV_MAX_BYTES) setFileError(`Ce fichier dépasse ${CV_MAX_LABEL}.`);
                    else setFileError(null);
                  }}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
                />
                <p className="mt-1 text-xs text-slate-500">PDF, {CV_MAX_LABEL} max.</p>
                {fileError && <p className="mt-1 text-sm text-red-600">{fileError}</p>}
              </div>
            )}
            {radio(RESUME, "Décrire mon profil en quelques lignes")}
            {source === RESUME && (
              <div className="space-y-3 pl-6">
                <div>
                  <label htmlFor="letter-summary" className="text-xs font-medium text-slate-600">
                    Ton profil : formation, expériences, compétences, ce que tu cherches
                  </label>
                  <textarea
                    id="letter-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    maxLength={PROFILE_SUMMARY_MAX}
                    rows={5}
                    placeholder="Ex. Master en marketing digital (2025). 2 stages en e-commerce chez… Maîtrise de Google Analytics, SEO…"
                    className="input mt-1 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Seuls les éléments que tu indiques seront utilisés : rien n&apos;est inventé.
                  </p>
                </div>
              </div>
            )}
            {profileCvs.length === 0 && (
              <p className="pt-1 text-xs text-slate-500">
                Astuce : enregistre ton CV dans{" "}
                <Link href="/profil" className="font-medium text-blue-700 underline underline-offset-2">
                  Mon profil
                </Link>{" "}
                pour l&apos;utiliser directement.
              </p>
            )}
          </fieldset>

          {signerName ? (
            <p className="text-xs text-slate-600">
              Lettre signée <strong className="font-medium text-slate-900">{signerName}</strong> (nom de ton compte).
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              Ajoute ton prénom et ton nom dans{" "}
              <Link href="/profil" className="font-medium underline underline-offset-2">
                Mon profil
              </Link>{" "}
              pour signer la lettre
              {source === RESUME ? " : ils sont nécessaires avec « Décrire mon profil »." : " (sinon, le nom de ton CV est utilisé)."}
            </p>
          )}
          {!hasOfferDescription && (
            <p className="text-xs text-amber-700">
              Cette candidature n&apos;a pas de description d&apos;offre : la lettre sera moins
              personnalisée. Ajoute la description pour un meilleur résultat.
            </p>
          )}
          {hasLetter && (
            <p className="text-xs text-amber-700">La nouvelle lettre remplacera la lettre actuelle.</p>
          )}
          <p className="text-xs text-slate-500">
            Ton profil et l&apos;offre sont transmis à Claude (Anthropic) pour la rédaction.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={generating || !sourceReady}
              className="btn-primary px-4 py-2 text-sm"
            >
              {generating ? "Rédaction en cours…" : "Générer ma lettre de motivation"}
            </button>
            {hasLetter && !generating && (
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
            )}
          </div>

          {generating && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
              />
              L&apos;assistant rédige ta lettre… cela peut prendre jusqu&apos;à une minute.
            </p>
          )}
          {state.status === "error" && !generating && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {state.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
