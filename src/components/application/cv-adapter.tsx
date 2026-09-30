"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import {
  adaptCvAction,
  generateImprovedCvAction,
  type AdaptCvState,
  type GenerateCvState,
} from "@/app/actions/cv";
import { CV_MAX_BYTES, CV_MAX_LABEL, type CvSuggestions, type ProfileCv } from "@/lib/cv-types";

const initialAdaptState: AdaptCvState = { status: "idle" };
const initialGenerateState: GenerateCvState = { status: "idle" };

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Valeur de source pour « importer un nouveau CV » (sinon : id d'un CV du profil). */
const UPLOAD = "upload";

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
    />
  );
}

function SuggestionList({
  icon,
  title,
  items,
  empty,
  tone,
}: {
  icon: string;
  title: string;
  items: string[];
  empty: string;
  tone: "match" | "missing";
}) {
  const styles =
    tone === "match"
      ? { box: "border-emerald-200 bg-emerald-50/60", marker: "text-emerald-600" }
      : { box: "border-amber-200 bg-amber-50/60", marker: "text-amber-600" };

  return (
    <section className={`rounded-xl border p-4 ${styles.box}`}>
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <span aria-hidden="true">{icon}</span> {title}
        <span className="text-sm font-normal text-slate-500">({items.length})</span>
      </h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-slate-800">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="flex gap-2">
              <span aria-hidden="true" className={styles.marker}>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function SuggestionsView({ suggestions }: { suggestions: CvSuggestions }) {
  return (
    <div className="grid gap-4">
      <SuggestionList
        icon="✅"
        title="Ce qui matche"
        items={suggestions.ce_qui_matche}
        empty="Aucun point fort identifié pour ce poste."
        tone="match"
      />
      <SuggestionList
        icon="⚠️"
        title="Ce qui manque"
        items={suggestions.ce_qui_manque}
        empty="Rien d'important ne manque à ton CV pour ce poste."
        tone="missing"
      />
    </div>
  );
}

export function CvAdapter({
  applicationId,
  hasOfferDescription,
  aiEnabled,
  saved,
  savedAt,
  profileCvs,
  hasImprovedCv,
}: {
  applicationId: string;
  hasOfferDescription: boolean;
  aiEnabled: boolean;
  saved: CvSuggestions | null;
  savedAt: string | null;
  profileCvs: ProfileCv[];
  hasImprovedCv: boolean;
}) {
  const [adaptState, adaptAction, analyzing] = useActionState(adaptCvAction, initialAdaptState);
  const [generateState, generateAction, generating] = useActionState(
    generateImprovedCvAction,
    initialGenerateState,
  );

  // Source du CV (id d'un CV du profil, ou "upload"), partagée par l'analyse et la
  // génération du CV amélioré.
  const [source, setSource] = useState<string>(profileCvs[0]?.id ?? UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Le choix du CV s'affiche à la demande ; il se referme dès qu'une analyse réussit
  // (l'état de l'action change par rapport à celui de l'ouverture).
  const [pickerOpenedAt, setPickerOpenedAt] = useState<AdaptCvState | null>(null);

  const result = adaptState.status === "success" ? adaptState : null;
  const suggestions = result?.suggestions ?? saved;
  const generatedAt = result?.generatedAt ?? savedAt;
  const busy = analyzing || generating;
  const selectedProfileCv = profileCvs.find((cv) => cv.id === source) ?? null;
  const sourceReady = source === UPLOAD ? Boolean(file) && !fileError : Boolean(selectedProfileCv);
  const pickerOpen =
    pickerOpenedAt !== null &&
    (analyzing || adaptState === pickerOpenedAt || adaptState.status === "error");

  function buildFormData() {
    const formData = new FormData();
    formData.set("id", applicationId);
    if (source === UPLOAD) {
      formData.set("source", "upload");
      if (file) formData.set("cv", file);
    } else {
      formData.set("source", "profil");
      formData.set("cvId", source);
    }
    return formData;
  }

  function runAnalysis() {
    if (!sourceReady || busy) return;
    const formData = buildFormData();
    startTransition(() => adaptAction(formData));
  }

  function runGeneration() {
    if (!sourceReady || busy) {
      setPickerOpenedAt(adaptState); // il faut d'abord choisir un CV
      return;
    }
    const formData = buildFormData();
    startTransition(() => generateAction(formData));
  }

  const radioClass = "flex cursor-pointer items-start gap-2.5 text-sm text-slate-700";

  const sourcePicker = (
    <fieldset className="space-y-3" disabled={busy}>
      <legend className="text-sm font-medium text-slate-700">Quel CV utiliser ?</legend>

      {profileCvs.length > 0 ? (
        <div className="space-y-2">
          {profileCvs.map((cv) => (
            <label key={cv.id} className={radioClass}>
              <input
                type="radio"
                name="cv-source"
                checked={source === cv.id}
                onChange={() => setSource(cv.id)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                {cv.name} <span className="text-slate-500">({cv.fileName})</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Astuce : enregistre tes CV dans{" "}
          <Link href="/profil" className="font-medium text-blue-700 underline underline-offset-2">
            Mon profil
          </Link>{" "}
          pour ne plus avoir à les importer.
        </p>
      )}

      <div className="space-y-2">
        {profileCvs.length > 0 && (
          <label className={radioClass}>
            <input
              type="radio"
              name="cv-source"
              checked={source === UPLOAD}
              onChange={() => setSource(UPLOAD)}
              className="mt-0.5 accent-blue-600"
            />
            <span>Importer un nouveau CV</span>
          </label>
        )}
        {source === UPLOAD && (
          <div className={profileCvs.length > 0 ? "pl-6" : ""}>
            <label htmlFor="cv-file" className="sr-only">
              CV au format PDF
            </label>
            <input
              id="cv-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (!selected) setFileError(null);
                else if (selected.type && selected.type !== "application/pdf")
                  setFileError("Choisis un fichier PDF.");
                else if (selected.size > CV_MAX_BYTES) setFileError(`Ce fichier dépasse ${CV_MAX_LABEL}.`);
                else setFileError(null);
              }}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-500">PDF, {CV_MAX_LABEL} max.</p>
            {fileError && <p className="mt-1 text-sm text-red-600">{fileError}</p>}
          </div>
        )}
      </div>
    </fieldset>
  );

  return (
    <section aria-labelledby="cv-title" className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="cv-title" className="font-semibold text-slate-900">
            <span aria-hidden="true">✨ </span>Adapter mon CV
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {suggestions && generatedAt
              ? `Suggestions générées le ${dateTimeFormatter.format(new Date(generatedAt))}.`
              : "L'assistant compare ton CV à l'offre et te dit quoi mettre en avant."}
          </p>
        </div>
        {!pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpenedAt(adaptState)}
            disabled={!aiEnabled || busy}
            className="btn-primary px-4 py-2 text-sm"
          >
            {suggestions ? "Refaire l'analyse" : "Adapter mon CV"}
          </button>
        )}
      </div>

      {!aiEnabled && (
        <p className="mt-3 text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      )}

      {pickerOpen && (
        <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          {sourcePicker}
          {!hasOfferDescription && (
            <p className="text-xs text-amber-700">
              Cette candidature n&apos;a pas de description d&apos;offre : les suggestions se baseront
              sur l&apos;intitulé du poste et seront moins précises.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Ton CV est transmis à Claude (Anthropic) pour l&apos;analyse.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={busy || !sourceReady}
              className="btn-primary px-4 py-2 text-sm"
            >
              {analyzing ? "Analyse en cours…" : "Analyser mon CV"}
            </button>
            {!busy && (
              <button
                type="button"
                onClick={() => setPickerOpenedAt(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
            )}
          </div>
          {analyzing && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner />
              L&apos;assistant lit ton CV et l&apos;offre… cela prend généralement 30 à 60 secondes.
            </p>
          )}
          {adaptState.status === "error" && !analyzing && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {adaptState.message}
            </p>
          )}
        </div>
      )}

      {suggestions && !analyzing && (
        <div className="mt-5 space-y-5">
          <SuggestionsView suggestions={suggestions} />

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <h3 className="font-semibold text-slate-900">📄 CV amélioré</h3>
            <p className="mt-1 text-sm text-slate-600">
              Génère un CV complet qui applique ces suggestions, avec les améliorations surlignées.
              Tu pourras le modifier puis l&apos;exporter en PDF.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runGeneration}
                disabled={busy || !aiEnabled}
                className="btn-primary px-4 py-2 text-sm"
              >
                {generating
                  ? "Rédaction en cours…"
                  : hasImprovedCv
                    ? "Regénérer le CV amélioré"
                    : "Générer mon CV amélioré"}
              </button>
              {hasImprovedCv && !generating && (
                <Link
                  href={`/candidatures/${applicationId}/cv`}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-300 hover:bg-white"
                >
                  Ouvrir mon CV amélioré →
                </Link>
              )}
            </div>
            {!sourceReady && !generating && (
              <p className="mt-2 text-xs text-slate-500">
                Le CV d&apos;origine est nécessaire : choisis-le via « Refaire l&apos;analyse » ou
                enregistre-le dans ton profil.
              </p>
            )}
            {generating && (
              <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Spinner />
                Rédaction de ton CV amélioré… cela peut prendre jusqu&apos;à une minute.
              </p>
            )}
            {generateState.status === "error" && !generating && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                {generateState.message}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
