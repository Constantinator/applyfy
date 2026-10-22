"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  createApplicationAction,
  type NewApplicationField,
  type NewApplicationState,
} from "@/app/actions/applications";
import {
  importOfferAction,
  importOfferFromTextAction,
  summarizeOfferAction,
  type ImportOfferResult,
} from "@/app/actions/offer";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { normalizeCompanyName } from "@/lib/normalize";
import {
  OFFER_DESCRIPTION_MAX_LENGTH,
  OFFER_PASTED_TEXT_MAX_LENGTH,
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
    loading: "text-slate-500 dark:text-slate-400",
    success: "text-emerald-700 dark:text-emerald-300",
    error: "text-amber-800 dark:text-amber-200",
  }[status.state];
  return (
    <p role="status" className={`flex items-center gap-2 text-sm ${styles}`}>
      {status.state === "loading" && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-blue-600"
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
      <label htmlFor={name} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      )}
    </div>
  );
}

export function NewApplicationForm({
  aiEnabled,
  summaryUsage,
  resetLabel,
}: {
  aiEnabled: boolean;
  /** Résumés générés ce mois-ci. */
  summaryUsage: AiUsageCount;
  /** Date de remise à zéro du compteur (ex. « 1er novembre 2026 »). */
  resetLabel: string;
}) {
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
  // Limite signalée par le serveur (compteur de la page éventuellement périmé).
  const [summaryLimitHit, setSummaryLimitHit] = useState(false);
  // Résultat incomplet de l'import depuis un lien : offre retirée, échec total (site
  // illisible, LinkedIn…) ou partiel. `missing` = champs que l'import n'a pas pu remplir.
  const [importAlert, setImportAlert] = useState<{
    kind: "not_found" | "failed" | "partial";
    missing: ImportedField[];
    message?: string;
  } | null>(null);
  // Repli après un échec : texte de l'offre collé à la main, analysé par l'IA.
  const [pastedText, setPastedText] = useState("");
  const [textImportStatus, setTextImportStatus] = useState<AsyncStatus>({ state: "idle" });

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
    setTextImportStatus({ state: "idle" });

    applyImportResult(await importOfferAction(url), "Pré-rempli depuis la page");
  }

  async function importFromText() {
    setTextImportStatus({ state: "loading" });
    const result = await importOfferFromTextAction(pastedText);
    if (!result.ok) {
      setTextImportStatus({ state: "error", message: result.error });
      return;
    }
    setTextImportStatus({ state: "idle" });
    setPastedText("");
    applyImportResult(result, "Pré-rempli depuis le texte collé");
  }

  function applyImportResult(result: ImportOfferResult, successPrefix: string) {
    const now = current.current;
    // Seuls les champs encore vides sont signalés comme « à compléter ».
    const stillEmpty = (fields: readonly ImportedField[]) => fields.filter((f) => !now[f].trim());

    if (!result.ok) {
      setImportStatus({ state: "idle" }); // le bandeau d'alerte prend le relais
      setImportAlert(
        result.kind === "not_found"
          ? { kind: "not_found", missing: [], message: result.error }
          : { kind: "failed", missing: stillEmpty(IMPORTED_FIELDS) },
      );
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
              message: `✓ ${successPrefix} : ${filled.join(", ")}. Vérifie les informations.`,
            }
          : { state: "success", message: "✓ Tous les champs étaient déjà remplis." },
      );
    }
  }

  async function generateSummary() {
    setSummaryStatus({ state: "loading" });
    const result = await summarizeOfferAction(description);
    if (!result.ok) {
      if (result.limitReached) {
        setSummaryLimitHit(true);
        setSummaryStatus({ state: "idle" }); // le bandeau prend le relais
      } else {
        setSummaryStatus({ state: "error", message: result.error });
      }
      return;
    }
    setSummary(result.summary.slice(0, OFFER_SUMMARY_MAX_LENGTH));
    setSummaryStatus({ state: "success", message: "✓ Résumé généré. Tu peux le modifier." });
  }

  const summaryLimitReached = summaryLimitHit || isLimitReached(summaryUsage);
  const canSummarize =
    aiEnabled &&
    !summaryLimitReached &&
    description.trim().length >= SUMMARY_MIN_LENGTH && summaryStatus.state !== "loading";
  // Le bandeau disparaît quand tous les champs signalés ont été complétés.
  const fieldValues: Record<ImportedField, string> = { company, position, location, description };
  const missingNow = importAlert?.missing.filter((f) => !fieldValues[f].trim()) ?? [];
  const alertVisible =
    importAlert !== null && (importAlert.kind === "not_found" || missingNow.length > 0);
  const showPasteFallback = alertVisible && importAlert.kind === "failed" && aiEnabled;
  const highlight = (field: ImportedField) =>
    alertVisible && importAlert.kind !== "not_found" && missingNow.includes(field)
      ? importAlert.kind === "failed"
        ? " ring-2 ring-orange-300"
        : " ring-2 ring-yellow-400"
      : "";

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30"
        >
          {state.message}
        </p>
      )}

      <section className="space-y-4 card p-5 sm:p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white">L&apos;offre</h2>

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
                className="rounded-lg px-3 text-sm font-medium whitespace-nowrap text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-400/30 hover:bg-blue-50"
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
              importAlert.kind === "partial"
                ? "border-yellow-400 bg-yellow-100 text-yellow-950"
                : "border-orange-300 bg-orange-50 dark:bg-orange-500/15 text-orange-900"
            }`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {importAlert.kind === "partial" ? "⚠️" : "⛔"}
            </span>
            <p className="font-medium">
              {importAlert.kind === "not_found"
                ? `${importAlert.message} Vérifie le lien, ou remplis les informations manuellement ci-dessous.`
                : importAlert.kind === "failed"
                  ? aiEnabled
                    ? "Impossible de lire cette page automatiquement. Colle le texte de l'offre ci-dessous, ou remplis les champs à la main."
                    : "Impossible de lire cette page automatiquement. Remplis les informations manuellement ci-dessous."
                  : "Certaines informations n'ont pas pu être récupérées automatiquement. Vérifie et complète les champs ci-dessous."}
            </p>
          </div>
        )}

        {showPasteFallback && (
          <div className="space-y-2">
            <label htmlFor="pasted_offer_text" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Texte de l&apos;offre
            </label>
            <textarea
              id="pasted_offer_text"
              rows={6}
              maxLength={OFFER_PASTED_TEXT_MAX_LENGTH}
              placeholder="Sélectionne tout le texte de l'annonce (Ctrl+A), copie-le et colle-le ici."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className={inputClassName}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={importFromText}
                disabled={pastedText.trim().length < SUMMARY_MIN_LENGTH || textImportStatus.state === "loading"}
                className="btn-primary px-4 py-2 text-sm"
              >
                Analyser le texte
              </button>
              {pastedText.trim().length < SUMMARY_MIN_LENGTH && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Colle le texte complet de l&apos;offre.
                </span>
              )}
            </div>
            <StatusLine status={textImportStatus} loadingText="Analyse du texte en cours…" />
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
              className="btn-primary px-4 py-2 text-sm"
            >
              {summaryLimitReached
                ? LIMIT_REACHED_LABEL
                : summary
                  ? "Régénérer le résumé"
                  : "Générer un résumé"}
            </button>
            {!aiEnabled ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">Résumé automatique non activé.</span>
            ) : (
              !summaryLimitReached &&
              description.trim().length < SUMMARY_MIN_LENGTH && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Colle la description complète pour pouvoir la résumer.
                </span>
              )
            )}
          </div>
          <StatusLine status={summaryStatus} loadingText="Génération du résumé…" />
          {aiEnabled && summaryLimitReached && summaryStatus.state !== "loading" && (
            <UsageLimitBanner resetLabel={resetLabel} />
          )}
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

      <p className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700">
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
