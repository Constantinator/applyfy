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
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

const initialState: NewApplicationState = { status: "idle" };

const inputClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none aria-invalid:border-rose-400 disabled:bg-slate-100 disabled:text-slate-400";

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
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
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
        <p id={`${name}-error`} className="text-sm text-rose-600">
          {error}
        </p>
      ) : (
        hint && <div className="text-xs text-slate-500">{hint}</div>
      )}
    </div>
  );
}

export function NewApplicationForm({
  defaultDate,
  aiEnabled,
}: {
  defaultDate: string;
  aiEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(createApplicationAction, initialState);
  const [status, setStatus] = useState<ApplicationStatus>("envoyee");

  // Champs contrôlés : pré-remplis par l'import d'offre et par le résumé.
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");

  const [importStatus, setImportStatus] = useState<AsyncStatus>({ state: "idle" });
  const [summaryStatus, setSummaryStatus] = useState<AsyncStatus>({ state: "idle" });
  // Import incapable de récupérer le texte de l'offre (site protégé, LinkedIn, Indeed…) :
  // on invite l'utilisateur à le copier-coller. Cause technique conservée pour l'afficher.
  const [manualCopyReason, setManualCopyReason] = useState<string | null>(null);

  // Valeurs courantes lisibles après un await (évite les closures périmées).
  const current = useRef({ company, position, location, description });
  useEffect(() => {
    current.current = { company, position, location, description };
  }, [company, position, location, description]);
  const lastImportedUrl = useRef("");

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
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
    setManualCopyReason(null);

    const result = await importOfferAction(url);
    if (!result.ok) {
      setImportStatus({ state: "idle" }); // le bandeau d'alerte prend le relais
      setManualCopyReason(result.error);
      return;
    }

    // On ne remplace jamais ce que l'utilisateur a déjà saisi.
    const { offer } = result;
    const now = current.current;
    const filled: string[] = [];
    if (offer.position && !now.position.trim()) {
      setPosition(offer.position.slice(0, 160));
      filled.push("poste");
    }
    if (offer.company && !now.company.trim()) {
      setCompany(normalizeCompanyName(offer.company).slice(0, 120));
      filled.push("entreprise");
    }
    if (offer.location && !now.location.trim()) {
      setLocation(offer.location.slice(0, 120));
      filled.push("localisation");
    }
    if (offer.description && !now.description.trim()) {
      setDescription(offer.description.slice(0, OFFER_DESCRIPTION_MAX_LENGTH));
      filled.push("description");
    } else if (!offer.description && !now.description.trim()) {
      // Page lue (poste, entreprise…) mais sans le texte de l'annonce.
      setManualCopyReason("Le texte de l'annonce n'est pas lisible sur cette page.");
    }

    setImportStatus(
      filled.length > 0
        ? {
            state: "success",
            message: `✓ Pré-rempli depuis la page : ${filled.join(", ")}. Vérifie les informations.`,
          }
        : { state: "error", message: "Aucune nouvelle information à pré-remplir depuis cette page." },
    );
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

  const isDraft = status === "brouillon";
  const canSummarize =
    aiEnabled && description.trim().length >= SUMMARY_MIN_LENGTH && summaryStatus.state !== "loading";
  const showManualCopyAlert = manualCopyReason !== null && description.trim() === "";

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {state.message}
        </p>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
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
                className="rounded-lg px-3 text-sm font-medium whitespace-nowrap text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
              >
                Récupérer les infos
              </button>
            )}
          </div>
        </Field>
        <StatusLine status={importStatus} loadingText="Lecture de l'offre en cours…" />

        {/* Disparaît dès que la description contient du texte (collé ou saisi). */}
        {showManualCopyAlert && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ⚠️
            </span>
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                Nous n&apos;avons pas pu récupérer le texte de cette offre automatiquement.
                Copie-colle manuellement la description de l&apos;offre dans le champ ci-dessous.
              </p>
              {manualCopyReason && <p className="text-amber-800">{manualCopyReason}</p>}
              <button
                type="button"
                onClick={() => document.getElementById("offer_description")?.focus()}
                className="font-semibold text-amber-900 underline underline-offset-4 hover:text-amber-700"
              >
                Aller au champ description ↓
              </button>
            </div>
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
              className={inputClassName}
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
              className={inputClassName}
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
            className={inputClassName}
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
            className={`${inputClassName} ${showManualCopyAlert ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generateSummary}
              disabled={!canSummarize}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
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
              className={`${inputClassName} bg-violet-50/40 leading-relaxed`}
            />
          </Field>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-slate-900">Suivi</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="status" label="Statut initial" error={errors.status}>
            <select
              {...a11y("status")}
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className={inputClassName}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            name="applied_at"
            label="Date de candidature"
            hint={isDraft ? "Pas de date pour un brouillon non envoyé." : undefined}
            error={errors.applied_at}
          >
            <input
              {...a11y("applied_at")}
              type="date"
              max={defaultDate}
              disabled={isDraft}
              defaultValue={values.applied_at || defaultDate}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className="rounded-lg px-4 py-2.5 text-center text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Ajouter la candidature"}
        </button>
      </div>
    </form>
  );
}
