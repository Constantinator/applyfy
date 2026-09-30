"use client";

import { startTransition, useActionState, useState } from "react";

import { adaptCvAction, type AdaptCvState } from "@/app/actions/cv";
import { CV_MAX_BYTES, CV_MAX_LABEL, type CvSuggestions } from "@/lib/cv-types";

const initialState: AdaptCvState = { status: "idle" };

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function SuggestionsView({ suggestions }: { suggestions: CvSuggestions }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-violet-50 p-4 text-sm leading-relaxed text-violet-950 ring-1 ring-violet-200">
        {suggestions.adequation}
      </p>

      {/* Empilées : la colonne principale de la fiche est trop étroite pour 3 colonnes lisibles. */}
      <div className="grid gap-4">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">🎯</span> Expériences à mettre en avant
          </h3>
          <ol className="mt-3 space-y-3">
            {suggestions.experiences.map((item) => (
              <li key={item.experience} className="text-sm">
                <p className="font-medium text-slate-900">{item.experience}</p>
                <p className="mt-0.5 text-slate-600">{item.pourquoi}</p>
                <p className="mt-1 text-indigo-700">→ {item.conseil}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">🔑</span> Mots-clés manquants
          </h3>
          <ul className="mt-3 space-y-3">
            {suggestions.mots_cles.map((item) => (
              <li key={item.mot_cle} className="text-sm">
                <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-900">
                  {item.mot_cle}
                </span>
                <p className="mt-1 text-slate-600">{item.ou_l_ajouter}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">💪</span> Points forts à valoriser
          </h3>
          <ul className="mt-3 space-y-3">
            {suggestions.points_forts.map((item) => (
              <li key={item.point} className="text-sm">
                <p className="font-medium text-slate-900">{item.point}</p>
                <p className="mt-0.5 text-slate-600">{item.comment_le_valoriser}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function CvAdapter({
  applicationId,
  hasOfferDescription,
  aiEnabled,
  saved,
  savedAt,
}: {
  applicationId: string;
  hasOfferDescription: boolean;
  aiEnabled: boolean;
  saved: CvSuggestions | null;
  savedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(adaptCvAction, initialState);
  // État de l'action au moment où le formulaire a été ouvert : dès qu'une nouvelle
  // analyse réussit, l'état change et le formulaire se referme de lui-même.
  const [openedAt, setOpenedAt] = useState<AdaptCvState | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const result = state.status === "success" ? state : null;
  const suggestions = result?.suggestions ?? saved;
  const generatedAt = result?.generatedAt ?? savedAt;
  const showForm =
    openedAt !== null && (pending || state === openedAt || state.status === "error");

  function closeForm() {
    setOpenedAt(null);
    setFileName(null);
    setFileError(null);
  }

  return (
    <section
      aria-labelledby="cv-title"
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="cv-title" className="font-semibold text-slate-900">
            <span aria-hidden="true">✨ </span>Adapter mon CV
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {suggestions && generatedAt
              ? `Suggestions générées le ${dateTimeFormatter.format(new Date(generatedAt))}.`
              : "Importe ton CV : l'assistant te dit quoi mettre en avant pour ce poste."}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setOpenedAt(state)}
            disabled={!aiEnabled}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {suggestions ? "Refaire l'analyse" : "Adapter mon CV"}
          </button>
        )}
      </div>

      {!aiEnabled && (
        <p className="mt-3 text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      )}

      {showForm && (
        <form
          // Soumission manuelle (et non via action=) : React ne vide pas le formulaire,
          // le fichier reste sélectionné si l'analyse échoue et doit être relancée.
          onSubmit={(e) => {
            e.preventDefault();
            if (fileError || !fileName || pending) return;
            const formData = new FormData(e.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
        >
          <input type="hidden" name="id" value={applicationId} />
          <label htmlFor="cv" className="block text-sm font-medium text-slate-700">
            Ton CV (PDF, {CV_MAX_LABEL} max)
          </label>
          <input
            id="cv"
            name="cv"
            type="file"
            accept="application/pdf,.pdf"
            required
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFileName(file?.name ?? null);
              if (!file) setFileError(null);
              else if (file.type && file.type !== "application/pdf") setFileError("Choisis un fichier PDF.");
              else if (file.size > CV_MAX_BYTES) setFileError(`Ce fichier dépasse ${CV_MAX_LABEL}.`);
              else setFileError(null);
            }}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
          />
          {fileError && <p className="text-sm text-rose-600">{fileError}</p>}
          {!hasOfferDescription && (
            <p className="text-xs text-amber-700">
              Cette candidature n&apos;a pas de description d&apos;offre : les suggestions se baseront
              sur l&apos;intitulé du poste et seront moins précises.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Ton CV est transmis à Claude (Anthropic) pour l&apos;analyse ; Applyfy ne le conserve pas.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending || !fileName || Boolean(fileError)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pending ? "Analyse en cours…" : "Analyser mon CV"}
            </button>
            {!pending && (
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
            )}
          </div>

          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600"
              />
              L&apos;assistant lit ton CV et l&apos;offre… cela prend généralement 20 à 40 secondes.
            </p>
          )}
          {state.status === "error" && !pending && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
            >
              {state.message}
            </p>
          )}
        </form>
      )}

      {suggestions && !pending && (
        <div className="mt-5">
          <SuggestionsView suggestions={suggestions} />
        </div>
      )}
    </section>
  );
}
