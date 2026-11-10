"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { confirmLumeoActionAction } from "@/app/actions/lumeo-actions";
import type { LumeoProposalState } from "@/lib/lumeo-actions";
import { LUMEO_ACTION_TEXTS as T } from "@/lib/lumeo-texts";

import type { RelanceBox } from "./lumeo-panel";

/**
 * Carte de confirmation d'une action proposée par Lumeo : ce qui va être fait, sur quelle
 * candidature, quel quota sera consommé. L'action ne part qu'au clic sur « Confirmer » ; le bouton
 * se désactive dès le clic (verrou synchrone en plus de l'état), et le serveur n'accepte qu'une
 * exécution à la fois.
 */
export function LumeoActionCard({
  proposal,
  update,
  relanceBox = null,
}: {
  proposal: LumeoProposalState;
  update: (patch: Partial<LumeoProposalState>) => void;
  /** Boîte « Relancer » de la fiche ouverte : texte de départ et destination du brouillon. */
  relanceBox?: RelanceBox | null;
}) {
  const router = useRouter();
  const clicked = useRef(false);
  const [copied, setCopied] = useState(false);
  const [put, setPut] = useState(false);
  const box = proposal.type === "relance" && relanceBox?.applicationId === proposal.applicationId ? relanceBox : null;
  const status = proposal.status ?? "idle";
  const outcome = proposal.outcome;

  async function confirm() {
    if (clicked.current || status !== "idle" || proposal.blocked) return;
    clicked.current = true;
    update({ status: "running" });
    try {
      let request: Record<string, unknown> = { type: proposal.type, applicationId: proposal.applicationId };
      if (proposal.type === "relance") {
        // Texte de départ : celui de la boîte « Relancer » (modifications comprises), sinon le
        // serveur part du message pré-écrit. Le ticket (panneau) est renvoyé tel quel.
        const source = box?.read().trim();
        request = { ...request, origin: proposal.origin ?? "box", ...(proposal.ticket ? { ticket: proposal.ticket } : {}), ...(source ? { source } : {}) };
      }
      const result = await confirmLumeoActionAction(request);
      update({ status: result.ok ? "done" : "failed", outcome: result });
      if (result.ok && proposal.type !== "relance") router.refresh(); // fiche à jour (résumé, lettre, CV lié)
    } catch {
      update({ status: "failed", outcome: { ok: false, message: T.failed } });
    }
  }

  return (
    <div className="mt-1 w-full max-w-[92%] rounded-card border border-line bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold tracking-[0.08em] text-blue-600 uppercase dark:text-blue-400">{proposal.title}</p>
      <p className="mt-1.5 text-ink dark:text-slate-100">{proposal.description}</p>
      <p className="mt-1.5 text-[13px] text-muted dark:text-slate-400">{proposal.quota}</p>

      {status === "idle" && proposal.blocked && (
        <p role="status" className="mt-2 text-[13px] text-ink dark:text-slate-200">
          {proposal.blocked}{" "}
          <Link href="/premium" className="ui-link">
            {T.premium}
          </Link>
        </p>
      )}

      {(status === "idle" || status === "running") && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={status === "running" || Boolean(proposal.blocked)}
            aria-busy={status === "running"}
            className="ui-btn-primary min-h-11"
          >
            {status === "running" ? T.running : T.confirm}
          </button>
          <button
            type="button"
            onClick={() => update({ status: "cancelled" })}
            disabled={status === "running"}
            className="ui-btn-secondary min-h-11"
          >
            {T.cancel}
          </button>
        </div>
      )}

      {status === "cancelled" && <p className="mt-2 text-[13px] text-muted dark:text-slate-400">{T.cancelled}</p>}

      {status === "done" && outcome?.ok && outcome.draft && (
        <div className="mt-3">
          <p className="text-[13px] font-medium text-ink dark:text-slate-100">{T.draftLabel}</p>
          <p className="mt-1.5 rounded-xl border border-line bg-box p-3 leading-relaxed whitespace-pre-wrap text-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {outcome.draft}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(outcome.draft ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
              className="ui-btn-secondary min-h-11"
            >
              {copied ? T.copied : T.copy}
            </button>
            {box && (
              <button
                type="button"
                onClick={() => {
                  box.write(outcome.draft ?? "");
                  setPut(true);
                }}
                className="ui-btn-secondary min-h-11"
              >
                {T.putInBox}
              </button>
            )}
          </div>
          {put && (
            <p role="status" className="mt-2 text-[13px] text-muted dark:text-slate-400">
              {T.putDone}
            </p>
          )}
        </div>
      )}

      {(status === "done" || status === "failed") && outcome && (
        <p role="status" className="mt-2 text-[13px] text-ink dark:text-slate-200">
          {outcome.message}{" "}
          {outcome.link && (
            <Link href={outcome.link.href} className="ui-link font-medium">
              {outcome.link.label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
