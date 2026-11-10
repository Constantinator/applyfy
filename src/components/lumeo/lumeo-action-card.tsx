"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { confirmLumeoActionAction } from "@/app/actions/lumeo-actions";
import type { LumeoProposalState } from "@/lib/lumeo-actions";
import { LUMEO_ACTION_TEXTS as T } from "@/lib/lumeo-texts";

/**
 * Carte de confirmation d'une action proposée par Lumeo : ce qui va être fait, sur quelle
 * candidature, quel quota sera consommé. L'action ne part qu'au clic sur « Confirmer » ; le bouton
 * se désactive dès le clic (verrou synchrone en plus de l'état), et le serveur n'accepte qu'une
 * exécution à la fois.
 */
export function LumeoActionCard({
  proposal,
  update,
}: {
  proposal: LumeoProposalState;
  update: (patch: Partial<LumeoProposalState>) => void;
}) {
  const router = useRouter();
  const clicked = useRef(false);
  const status = proposal.status ?? "idle";
  const outcome = proposal.outcome;

  async function confirm() {
    if (clicked.current || status !== "idle" || proposal.blocked) return;
    clicked.current = true;
    update({ status: "running" });
    try {
      const result = await confirmLumeoActionAction({ type: proposal.type, applicationId: proposal.applicationId });
      update({ status: result.ok ? "done" : "failed", outcome: result });
      if (result.ok) router.refresh(); // fiche à jour (résumé, lettre, CV lié)
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
