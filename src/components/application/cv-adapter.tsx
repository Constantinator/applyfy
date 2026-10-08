"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { adaptCvAction, type AdaptCvState } from "@/app/actions/cv";
import { OnboardingTip } from "@/components/onboarding/onboarding-tip";

import { CvEditorLauncher } from "./editor-launchers";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { CV_MAX_BYTES, CV_MAX_LABEL, type CvSuggestions, type ProfileCv } from "@/lib/cv-types";

const initialAdaptState: AdaptCvState = { status: "idle" };

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

  // Source du CV à analyser (id d'un CV du profil, ou "upload").
  const [source, setSource] = useState<string>(profileCvs[0]?.id ?? UPLOAD);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Le choix du CV à analyser s'affiche à la demande ; il se referme dès qu'une analyse
  // réussit (l'état de l'action change par rapport à celui de l'ouverture).
  const [pickerOpenedAt, setPickerOpenedAt] = useState<AdaptCvState | null>(null);

  const result = adaptState.status === "success" ? adaptState : null;
  const suggestions = result?.suggestions ?? saved;
  const generatedAt = result?.generatedAt ?? savedAt;
  const busy = analyzing;
  const limitReached =
    isLimitReached(usage) || (adaptState.status === "error" && adaptState.limitReached === true);
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

      {/* Action principale : l'éditeur ; l'analyse est une aide facultative. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CvEditorLauncher
          applicationId={applicationId}
          profileCvs={profileCvs}
          hasCv={hasImprovedCv}
          aiEnabled={aiEnabled}
          limitReached={isLimitReached(editorUsage)}
          resetLabel={resetLabel}
          className="btn-primary px-4 py-2 text-sm"
        />
        <OnboardingTip id="adapter-cv" text="Analyse ton CV pour ce poste">
          <button
            type="button"
            onClick={() => setPickerOpenedAt(adaptState)}
            disabled={!aiEnabled || busy || limitReached || pickerOpen}
            className="btn-secondary px-4 py-2 text-sm"
          >
            {limitReached ? LIMIT_REACHED_LABEL : "Analyser mon CV"}
          </button>
        </OnboardingTip>
      </div>

      {!aiEnabled && <p className="mt-3 text-xs text-slate-500">Analyse non disponible sur ce site.</p>}

      {aiEnabled && limitReached && !busy && (
        <div className="mt-4">
          <UsageLimitBanner resetLabel={resetLabel} />
        </div>
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
