"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import {
  adaptCvAction,
  openCvEditorAction,
  type AdaptCvState,
  type OpenCvEditorState,
} from "@/app/actions/cv";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { CV_MAX_BYTES, CV_MAX_LABEL, type CvSuggestions, type ProfileCv } from "@/lib/cv-types";

const initialAdaptState: AdaptCvState = { status: "idle" };
const initialEditorState: OpenCvEditorState = { status: "idle" };

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SuggestionList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "match" | "missing";
}) {
  const styles =
    tone === "match"
      ? { box: "border-[#BFDBFE] bg-[#F0F7FF]", title: "text-[#1E40AF]", marker: "text-[#1E40AF]/60" }
      : { box: "border-[#E2E8F0] bg-[#F8FAFC]", title: "text-[#374151]", marker: "text-[#9CA3AF]" };

  return (
    <section className={`rounded-xl border p-4 ${styles.box}`}>
      <h3 className={`flex items-center gap-2 font-semibold ${styles.title}`}>
        {tone === "match" ? <CheckIcon className="h-4 w-4" /> : <DashIcon className="h-4 w-4" />}
        {title}
        <span className="text-sm font-normal text-slate-500">({items.length})</span>
      </h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-[#374151]">
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
        title="Ce qui matche"
        items={suggestions.ce_qui_matche}
        empty="Aucun point fort identifié pour ce poste."
        tone="match"
      />
      <SuggestionList
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
  usage,
  editorUsage,
  resetLabel,
}: {
  applicationId: string;
  hasOfferDescription: boolean;
  aiEnabled: boolean;
  saved: CvSuggestions | null;
  savedAt: string | null;
  profileCvs: ProfileCv[];
  /** Un CV est déjà ouvert dans l'éditeur pour cette candidature. */
  hasImprovedCv: boolean;
  /** Analyses de CV utilisées ce mois-ci. */
  usage: AiUsageCount;
  /** CV ouverts dans l'éditeur (première ouverture d'un CV du profil) ce mois-ci. */
  editorUsage: AiUsageCount;
  /** Date de remise à zéro du compteur (ex. « 1er novembre 2026 »). */
  resetLabel: string;
}) {
  const [adaptState, adaptAction, analyzing] = useActionState(adaptCvAction, initialAdaptState);
  const [editorState, editorAction, opening] = useActionState(openCvEditorAction, initialEditorState);

  // Source du CV à analyser (id d'un CV du profil, ou "upload").
  const [source, setSource] = useState<string>(profileCvs[0]?.id ?? UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Le choix du CV à analyser s'affiche à la demande ; il se referme dès qu'une analyse
  // réussit (l'état de l'action change par rapport à celui de l'ouverture).
  const [pickerOpenedAt, setPickerOpenedAt] = useState<AdaptCvState | null>(null);
  // CV du profil à ouvrir dans l'éditeur, choisi quand le profil en contient plusieurs.
  const [editorPickerOpen, setEditorPickerOpen] = useState(false);
  const [editorCv, setEditorCv] = useState<string>(profileCvs[0]?.id ?? "");
  const [noProfileCv, setNoProfileCv] = useState(false);

  const result = adaptState.status === "success" ? adaptState : null;
  const suggestions = result?.suggestions ?? saved;
  const generatedAt = result?.generatedAt ?? savedAt;
  const busy = analyzing || opening;
  const limitReached =
    isLimitReached(usage) || (adaptState.status === "error" && adaptState.limitReached === true);
  const editorLimitReached =
    !hasImprovedCv &&
    (isLimitReached(editorUsage) || (editorState.status === "error" && editorState.limitReached === true));
  const selectedProfileCv = profileCvs.find((cv) => cv.id === source) ?? null;
  const sourceReady = source === UPLOAD ? Boolean(file) && !fileError : Boolean(selectedProfileCv);
  const pickerOpen =
    pickerOpenedAt !== null &&
    (analyzing || adaptState === pickerOpenedAt || adaptState.status === "error");

  function runAnalysis() {
    if (!sourceReady || busy) return;
    const formData = new FormData();
    formData.set("id", applicationId);
    if (source === UPLOAD) {
      formData.set("source", "upload");
      if (file) formData.set("cv", file);
    } else {
      formData.set("source", "profil");
      formData.set("cvId", source);
    }
    startTransition(() => adaptAction(formData));
  }

  function openEditor(cvId: string) {
    if (busy) return;
    const formData = new FormData();
    formData.set("id", applicationId);
    formData.set("cvId", cvId);
    startTransition(() => editorAction(formData));
  }

  /** « Ouvrir l'éditeur de CV » sans CV encore ouvert pour cette candidature. */
  function startEditor() {
    if (profileCvs.length === 0) setNoProfileCv(true);
    else if (profileCvs.length === 1) openEditor(profileCvs[0].id);
    else setEditorPickerOpen(true);
  }

  const radioClass = "flex cursor-pointer items-start gap-2.5 text-sm text-slate-700";

  const sourcePicker = (
    <fieldset className="space-y-3" disabled={busy}>
      <legend className="text-sm font-medium text-slate-700">Quel CV analyser ?</legend>

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

  // Action principale : l'analyse tant qu'elle n'est pas faite, ensuite l'éditeur.
  const analyzeClass = `${suggestions ? "btn-secondary" : "btn-primary"} px-4 py-2 text-sm`;
  const editorClass = `${suggestions ? "btn-primary" : "btn-secondary"} px-4 py-2 text-sm`;

  return (
    <section aria-labelledby="cv-title" className="card p-5">
      <div>
        <h2 id="cv-title" className="font-semibold text-slate-900">
          Adapter mon CV
        </h2>
        {suggestions && generatedAt && (
          <p className="mt-1 text-sm text-slate-500">
            Analyse du {dateTimeFormatter.format(new Date(generatedAt))}.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <OnboardingTip id="adapter-cv" text="Analyse ton CV pour ce poste">
          <button
            type="button"
            onClick={() => setPickerOpenedAt(adaptState)}
            disabled={!aiEnabled || busy || limitReached || pickerOpen}
            className={analyzeClass}
          >
            {limitReached ? LIMIT_REACHED_LABEL : "Analyser mon CV"}
          </button>
        </OnboardingTip>
        {hasImprovedCv ? (
          <Link href={`/candidatures/${applicationId}/cv`} className={editorClass}>
            Ouvrir l&apos;éditeur de CV
          </Link>
        ) : (
          <button
            type="button"
            onClick={startEditor}
            disabled={busy || editorLimitReached || editorPickerOpen}
            className={editorClass}
          >
            {opening ? "Ouverture…" : editorLimitReached ? LIMIT_REACHED_LABEL : "Ouvrir l'éditeur de CV"}
          </button>
        )}
      </div>

      {!aiEnabled && <p className="mt-3 text-xs text-slate-500">Analyse non disponible sur ce site.</p>}

      {aiEnabled && (limitReached || editorLimitReached) && !busy && (
        <div className="mt-4">
          <UsageLimitBanner resetLabel={resetLabel} />
        </div>
      )}

      {noProfileCv && profileCvs.length === 0 && (
        <p role="status" className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
          Enregistre ton CV dans{" "}
          <Link href="/profil" className="font-medium text-blue-700 underline underline-offset-2">
            Mon profil
          </Link>{" "}
          pour l&apos;ouvrir dans l&apos;éditeur.
        </p>
      )}

      {/* Plusieurs CV dans le profil : lequel ouvrir dans l'éditeur ? */}
      {editorPickerOpen && !hasImprovedCv && (
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <fieldset className="space-y-2" disabled={opening}>
            <legend className="text-sm font-medium text-slate-700">Quel CV ouvrir dans l&apos;éditeur ?</legend>
            {profileCvs.map((cv) => (
              <label key={cv.id} className={radioClass}>
                <input
                  type="radio"
                  name="editor-cv"
                  checked={editorCv === cv.id}
                  onChange={() => setEditorCv(cv.id)}
                  className="mt-0.5 accent-blue-600"
                />
                <span>
                  {cv.name} <span className="text-slate-500">({cv.fileName})</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openEditor(editorCv)}
              disabled={opening || !editorCv}
              className="btn-primary px-4 py-2 text-sm"
            >
              {opening ? "Ouverture…" : "Ouvrir"}
            </button>
            {!opening && (
              <button type="button" onClick={() => setEditorPickerOpen(false)} className="btn-secondary px-4 py-2 text-sm">
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      {opening && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner />
          Préparation de ton CV dans l&apos;éditeur… cela peut prendre jusqu&apos;à une minute la première fois.
        </p>
      )}
      {editorState.status === "error" && !editorState.limitReached && !opening && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {editorState.message}
        </p>
      )}

      {pickerOpen && (
        <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          {sourcePicker}
          {!hasOfferDescription && (
            <p className="text-xs text-amber-700">
              Cette candidature n&apos;a pas de description d&apos;offre : l&apos;analyse se basera sur
              l&apos;intitulé du poste et sera moins précise.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={busy || !sourceReady || limitReached}
              className="btn-primary px-4 py-2 text-sm"
            >
              {analyzing ? "Analyse en cours…" : limitReached ? LIMIT_REACHED_LABEL : "Analyser"}
            </button>
            {!busy && (
              <button
                type="button"
                onClick={() => setPickerOpenedAt(null)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Annuler
              </button>
            )}
          </div>
          {analyzing && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner />
              Analyse de ton CV et de l&apos;offre… cela prend généralement 30 à 60 secondes.
            </p>
          )}
          {adaptState.status === "error" && !adaptState.limitReached && !analyzing && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {adaptState.message}
            </p>
          )}
        </div>
      )}

      {suggestions && !analyzing && (
        <div className="mt-5">
          <SuggestionsView suggestions={suggestions} />
        </div>
      )}
    </section>
  );
}
