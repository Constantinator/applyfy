"use client";

import { useState, useTransition } from "react";

import { summarizeJobOfferAction } from "@/app/actions/job-offers";
import { FormattedText } from "@/components/formatted-text";
import { IconSparkles } from "@/components/icons";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";

import { AddOfferButton } from "./add-offer-button";

type SummaryState =
  | { status: "idle" }
  | { status: "done"; summary: string }
  | { status: "error"; message: string; limitReached: boolean };

/**
 * Pied du panneau de détails : ajout aux candidatures, résumé IA (essai gratuit), lien vers
 * l'offre originale. Le résumé s'affiche sous les boutons, dans une carte à part.
 */
export function OfferActions({
  offerId,
  search,
  title,
  url,
}: {
  offerId: string;
  /** Paramètres d'URL de la recherche en cours. */
  search: string;
  title: string;
  url: string;
}) {
  const [state, setState] = useState<SummaryState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function summarize() {
    startTransition(async () => {
      const result = await summarizeJobOfferAction(offerId, search);
      setState(
        result.ok
          ? { status: "done", summary: result.summary }
          : { status: "error", message: result.error, limitReached: result.limitReached === true },
      );
    });
  }

  return (
    <footer className="space-y-3 border-t border-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:px-7">
      <div className="flex flex-wrap items-start gap-2">
        <AddOfferButton offerId={offerId} search={search} title={title} className="items-start" />
        <button
          type="button"
          onClick={summarize}
          disabled={pending}
          className="ui-btn-secondary whitespace-nowrap"
        >
          <IconSparkles className="h-4 w-4" />
          {pending ? "Résumé en cours…" : state.status === "done" ? "Regénérer le résumé" : "Générer un résumé"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="ui-btn-secondary">
          Voir l&apos;offre
        </a>
      </div>

      {!pending && state.status === "error" &&
        (state.limitReached ? (
          <UsageLimitBanner />
        ) : (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.message}
          </p>
        ))}

      {state.status === "done" && (
        <section
          aria-label="Résumé de l'offre"
          className={`max-h-[40vh] overflow-y-auto rounded-block border border-line bg-surface p-4 dark:border-slate-700 dark:bg-slate-800/50 ${pending ? "opacity-60" : ""}`}
        >
          <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-white">
            <IconSparkles className="h-4 w-4" />
            Résumé de l&apos;offre
          </h3>
          <FormattedText text={state.summary} className="dark:text-slate-200" />
        </section>
      )}
    </footer>
  );
}
