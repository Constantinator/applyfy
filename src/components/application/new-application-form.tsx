"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  createApplicationAction,
  type NewApplicationField,
  type NewApplicationState,
} from "@/app/actions/applications";
import { importOfferAction, summarizeOfferAction } from "@/app/actions/offer";
import { normalizeCompanyName } from "@/lib/normalize";
import {
  OFFER_DESCRIPTION_MAX_LENGTH,
  OFFER_SUMMARY_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
} from "@/lib/offer-limits";

const initialState: NewApplicationState = { status: "idle" };

/** Champs que l'import depuis un lien tente de remplir. */
const IMPORTED_FIELDS = ["position", "company", "location", "description"] as const;
type ImportedField = (typeof IMPORTED_FIELDS)[number];
const FIELD_LABELS: Record<ImportedField, string> = {
  position: "poste",
  company: "entreprise",
  location: "localisation",
  description: "description",
};

const inputClassName =
  "input";

type AsyncStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function StatusLine({ status, loadingText }: { status: AsyncStatus; loadingText: string }) {
  if (status.state === "idle") return null;
  const styles = {
    loading: "text-slate-500",
    success: "text-emerald-700",
    error: "text-amber-700",
  }[status.state];
  return (
    <p role="status" className={`flex items-center gap-2 text-sm ${styles}`}>
      {status.state === "loading" && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
        />
      )}
      {status.state === "loading" ? loadingText : status.message}
    </p>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: NewApplicationField;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && <div className="text-xs text-slate-500">{hint}</div>
      )}
    </div>
  );
}

export function NewApplicationForm({ aiEnabled }: { aiEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(createApplicationAction, initialState);

  // Champs contrôlés : pré-remplis par l'import d'offre et par le résumé.
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");

  const [importStatus, setImportStatus] = useState<AsyncStatus>({ state: "idle" });
  const [summaryStatus, setSummaryStatus] = useState<AsyncStatus>({ state: "idle" });
  // Résultat incomplet de l'import depuis un lien : échec total (site bloqué, LinkedIn,
  // Indeed…) ou partiel. `missing` = champs que l'import n'a pas pu remplir.
  const [importAlert, setImportAlert] = useState<{
    kind: "failed" | "partial";
    missing: ImportedField[];
  } | null>(null);

  // Valeurs courantes lisibles après un await (évite les closures périmées).
  const current = useRef({ company, position, location, description });
  useEffect(() => {
    current.current = { company, position, location, description };
  }, [company, position, location, description]);
  const lastImportedUrl = useRef("");

  const errors = state.fieldErrors ?? {};
  const a11y = (name: NewApplicationField) => ({
    id: name,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  async function importFromUrl(raw: string) {
    const url = raw.trim();
    if (!isHttpUrl(url) || url === lastImportedUrl.current) return;
    lastImportedUrl.current = url;
    setImportStatus({ state: "loading" });
    setImportAlert(null);

    const result = await importOfferAction(url);
    const now = current.current;
    // Seuls les champs encore vides sont signalés comme « à compléter ».
    const stillEmpty = (fields: readonly ImportedField[]) => fields.filter((f) => !now[f].trim());

    if (!result.ok) {
      setImportStatus({ state: "idle" }); // le bandeau d'alerte prend le relais
      setImportAlert({ kind: "failed", missing: stillEmpty(IMPORTED_FIELDS) });
      return;
    }

    // On ne remplace jamais ce que l'utilisateur a déjà saisi.
    const { offer } = result;
    const retrieved: Record<ImportedField, string> = {
      position: offer.position.slice(0, 160),
      company: normalizeCompanyName(offer.company).slice(0, 120),
      location: offer.location.slice(0, 120),
      description: offer.description.slice(0, OFFER_DESCRIPTION_MAX_LENGTH),
    };
    const setters: Record<ImportedField, (value: string) => void> = {
      position: setPosition,
      company: setCompany,
      location: setLocation,
      description: setDescription,
    };
    const filled: string[] = [];
    for (const field of IMPORTED_FIELDS) {
      if (retrieved[field] && !now[field].trim()) {
        setters[field](retrieved[field]);
        filled.push(FIELD_LABELS[field]);
      }
    }

    const notRetrieved = IMPORTED_FIELDS.filter((field) => !retrieved[field]);
    if (notRetrieved.length === IMPORTED_FIELDS.length) {
      setImportStatus({ state: "idle" });
      setImportAlert({ kind: "failed", missing: stillEmpty(IMPORTED_FIELDS) });
    } else if (notRetrieved.length > 0) {
      setImportStatus({ state: "idle" });
      setImportAlert({ kind: "partial", missing: stillEmpty(notRetrieved) });
    } else {
      setImportStatus(
        filled.length > 0
          ? {
              state: "success",
              message: `✓ Pré-rempli depuis la page : ${filled.join(", ")}. Vérifie les informations.`,
            }
          : { state: "success", message: "✓ Tous les champs étaient déjà remplis." },
      );
    }
  }

  async function generateSummary() {
    setSummaryStatus({ state: "loading" });
    const result = await summarizeOfferAction(description);
    if (!result.ok) {
      setSummaryStatus({ state: "error", message: result.error });
      return;
    }
    setSummary(result.summary.slice(0, OFFER_SUMMARY_MAX_LENGTH));
    setSummaryStatus({ state: "success", message: "✓ Résumé généré. Tu peux le modifier." });
  }

  const canSummarize =
    aiEnabled && description.trim().length >= SUMMARY_MIN_LENGTH && summaryStatus.state !== "loading";
  // Le bandeau disparaît quand tous les champs signalés ont été complétés.
  const fieldValues: Record<ImportedField, string> = { company, position, location, description };
  const missingNow = importAlert?.missing.filter((f) => !fieldValues[f].trim()) ?? [];
  const alertVisible = importAlert !== null && missingNow.length > 0;
  const highlight = (field: ImportedField) =>
    alertVisible && missingNow.includes(field)
      ? importAlert.kind === "failed"
        ? " ring-2 ring-orange-300"
        : " ring-2 ring-yellow-300"
      : "";

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
        >
          {state.message}
        </p>
      )}

      <section className="space-y-4 card p-5 sm:p-6">
        <h2 className="font-semibold text-slate-900">L&apos;offre</h2>

        <Field
          name="offer_url"
          label="Lien de l'offre"
          hint="Colle le lien de l'annonce : le poste, l'entreprise et la localisation seront pré-remplis."
          error={errors.offer_url}
        >
          <div className="flex gap-2">
            <input
              {...a11y("offer_url")}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={offerUrl}
              onChange={(e) => setOfferUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text").trim();
                if (isHttpUrl(pasted)) void importFromUrl(pasted);
              }}
              onBlur={() => void importFromUrl(offerUrl)}
              className={inputClassName}
            />
            {isHttpUrl(offerUrl.trim()) && importStatus.state !== "loading" && (
              <button
                type="button"
                onClick={() => {
                  lastImportedUrl.current = "";
                  void importFromUrl(offerUrl);
                }}
                className="rounded-lg px-3 text-sm font-medium whitespace-nowrap text-blue-600 ring-1 ring-blue-200 hover:bg-blue-50"
              >
                Récupérer les infos
              </button>
            )}
          </div>
        </Field>
        <StatusLine status={importStatus} loadingText="Lecture de l'offre en cours…" />

        {/* Disparaît quand tous les champs signalés (surlignés) ont été complétés. */}
        {alertVisible && (
          <div
            role="alert"
            data-import-alert={importAlert.kind}
            className={`flex gap-3 rounded-xl border p-4 text-sm ${
              importAlert.kind === "failed"
                ? "border-orange-300 bg-orange-50 text-orange-900"
                : "border-yellow-300 bg-yellow-50 text-yellow-900"
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {importAlert.kind === "failed" ? "⛔" : "⚠️"}
            </span>
            <p className="font-medium">
              {importAlert.kind === "failed"
                ? "Ce site bloque l'import automatique. Remplis les informations manuellement ci-dessous."
                : "Certaines informations n'ont pas pu être récupérées automatiquement. Vérifie et complète les champs ci-dessous."}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="company" label="Nom de l'entreprise *" error={errors.company}>
            <input
              {...a11y("company")}
              required
              maxLength={120}
              autoComplete="organization"
              placeholder="Ex. Doctolib"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onBlur={() => setCompany((c) => normalizeCompanyName(c))}
              className={inputClassName + highlight("company")}
            />
          </Field>
          <Field name="position" label="Poste visé *" error={errors.position}>
            <input
              {...a11y("position")}
              required
              maxLength={160}
              placeholder="Ex. Product Manager"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className={inputClassName + highlight("position")}
            />
          </Field>
        </div>

        <Field name="location" label="Localisation" error={errors.location}>
          <input
            {...a11y("location")}
            maxLength={120}
            placeholder="Ex. Paris, Lyon, Télétravail…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClassName + highlight("location")}
          />
        </Field>

        <Field
          name="offer_description"
          label="Description de l'offre"
          hint="Facultatif : colle la description complète pour la garder même si l'annonce est retirée."
          error={errors.offer_description}
        >
          <textarea
            {...a11y("offer_description")}
            rows={8}
            maxLength={OFFER_DESCRIPTION_MAX_LENGTH}
            placeholder="Missions, profil recherché, avantages…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClassName + highlight("description")}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generateSummary}
              disabled={!canSummarize}
              className="inline-flex items-center gap-2 btn-primary px-4 py-2 text-sm"
            >
              <span aria-hidden="true">✨</span>
              {summary ? "Régénérer le résumé" : "Générer un résumé"}
            </button>
            {!aiEnabled ? (
              <span className="text-xs text-slate-500">Résumé automatique non activé.</span>
            ) : (
              description.trim().length < SUMMARY_MIN_LENGTH && (
                <span className="text-xs text-slate-500">
                  Colle la description complète pour pouvoir la résumer.
                </span>
              )
            )}
          </div>
          <StatusLine status={summaryStatus} loadingText="Génération du résumé…" />
        </div>

        {(summary || errors.offer_summary) && (
          <Field
            name="offer_summary"
            label="Résumé de l'offre"
            hint="Généré automatiquement : relis-le, tu peux le modifier. Il sera enregistré avec la candidature."
            error={errors.offer_summary}
          >
            <textarea
              {...a11y("offer_summary")}
              rows={10}
              maxLength={OFFER_SUMMARY_MAX_LENGTH}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`${inputClassName} bg-blue-50/40 leading-relaxed`}
            />
          </Field>
        )}
      </section>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
        La candidature sera créée en <strong>brouillon</strong>. Une fois ta candidature envoyée,
        clique sur « Marquer comme envoyée » depuis sa fiche.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className="btn-secondary px-4 py-2.5 text-sm"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          {pending ? "Enregistrement…" : "Ajouter la candidature"}
        </button>
      </div>
    </form>
  );
}
