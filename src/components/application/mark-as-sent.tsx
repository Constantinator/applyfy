"use client";

import { useActionState } from "react";

import { markAsSentAction, type ActionState } from "@/app/actions/applications";

const initialState: ActionState = { status: "idle" };

/** Bandeau mis en avant sur la fiche d'un brouillon : passer la candidature à « Envoyée ». */
export function MarkAsSent({ applicationId, today }: { applicationId: string; today: string }) {
  const [state, formAction, pending] = useActionState(markAsSentAction, initialState);

  return (
    <section
      aria-labelledby="mark-sent-title"
      className="ui-card-soft p-5 sm:p-7"
    >
      <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <input type="hidden" name="id" value={applicationId} />
        <div>
          <h2 id="mark-sent-title" className="ui-title-sm">
            Cette candidature est un brouillon
          </h2>
          <p className="mt-1 text-sm text-muted dark:text-slate-300">
            Tu as envoyé ta candidature ? Marque-la comme envoyée pour lancer le suivi et les
            rappels de relance.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="sent_on" className="mb-1 block text-[13px] font-semibold text-ink dark:text-slate-200">
              Envoyée le
            </label>
            <input
              id="sent_on"
              name="sent_on"
              type="date"
              defaultValue={today}
              max={today}
              required
              className="ui-input py-2 sm:w-auto"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="ui-btn-primary"
          >
            {pending ? "Enregistrement…" : "Marquer comme envoyée"}
          </button>
        </div>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
    </section>
  );
}
