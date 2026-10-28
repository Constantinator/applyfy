"use client";

import { PremiumButton } from "@/components/usage/usage-limit-banner";
import type { CoachChange, CoachProposal } from "@/lib/coach-proposals";

/** État d'une modification proposée dans l'éditeur. */
export type ChangeState = {
  status: "pending" | "accepted" | "refused" | "conflict";
  /** Message affiché sous la modification (échec, limite du mois). */
  error?: string;
  /** Limite du mois atteinte : bouton « Passer au Premium ». */
  limitReached?: boolean;
};

function Text({ text, tone }: { text: string; tone: "before" | "after" }) {
  return (
    <p
      className={`whitespace-pre-wrap rounded-md px-2 py-1 text-sm ${
        tone === "before"
          ? "bg-red-50 text-slate-500 line-through decoration-red-300 dark:bg-red-500/10 dark:text-slate-400"
          : "bg-emerald-50 text-slate-800 dark:bg-emerald-500/10 dark:text-slate-100"
      }`}
    >
      {text}
    </p>
  );
}

function ChangeCard({
  change,
  state,
  busy,
  onAccept,
  onRefuse,
  onUndo,
}: {
  change: CoachChange;
  state: ChangeState;
  busy: boolean;
  onAccept: () => void;
  onRefuse: () => void;
  onUndo: () => void;
}) {
  return (
    <li className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{change.label}</p>
      {change.before !== null && change.before.trim() !== "" ? (
        <>
          <span className="sr-only">Avant :</span>
          <Text text={change.before} tone="before" />
        </>
      ) : (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{change.kind === "bullet" ? "Nouvelle puce" : "Ajout"}</p>
      )}
      <span className="sr-only">Après :</span>
      <Text text={change.after} tone="after" />

      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        {state.status === "pending" && (
          <>
            <button type="button" onClick={onAccept} disabled={busy} className="btn-primary px-3 py-1 text-xs">
              {busy ? "…" : "Accepter"}
            </button>
            <button type="button" onClick={onRefuse} disabled={busy} className="btn-secondary px-3 py-1 text-xs">
              Refuser
            </button>
          </>
        )}
        {state.status === "accepted" && (
          <>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">✓ Ajouté à ton CV</span>
            <button
              type="button"
              onClick={onUndo}
              className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white"
            >
              Annuler
            </button>
          </>
        )}
        {state.status === "refused" && <span className="text-slate-500">Refusé</span>}
        {state.status === "conflict" && (
          <span className="text-slate-500">Ce passage a été modifié entre-temps : proposition non appliquée.</span>
        )}
      </div>
      {state.error && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
          {state.limitReached && <PremiumButton />}
        </div>
      )}
    </li>
  );
}

/**
 * Modifications proposées par le coach : chacune en « avant / après », à accepter ou refuser ;
 * une modification acceptée peut être annulée. Rien n'est appliqué avant « Accepter ».
 */
export function CoachProposalView({
  proposal,
  states,
  busyChange,
  onAccept,
  onRefuse,
  onUndo,
}: {
  proposal: CoachProposal;
  states: Record<string, ChangeState>;
  busyChange: string | null;
  onAccept: (change: CoachChange) => void;
  onRefuse: (change: CoachChange) => void;
  onUndo: (change: CoachChange) => void;
}) {
  return (
    <ul aria-label="Modifications proposées" className="w-full max-w-[95%] space-y-2">
      {proposal.changes.map((change) => (
        <ChangeCard
          key={change.id}
          change={change}
          state={states[change.id] ?? { status: "pending" }}
          busy={busyChange === change.id}
          onAccept={() => onAccept(change)}
          onRefuse={() => onRefuse(change)}
          onUndo={() => onUndo(change)}
        />
      ))}
    </ul>
  );
}
