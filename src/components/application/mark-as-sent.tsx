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
      className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6"
    >
      <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <input type="hidden" name="id" value={applicationId} />
        <div>
          <h2 id="mark-sent-title" className="font-semibold text-blue-950">
            Cette candidature est un brouillon
          </h2>
          <p className="mt-1 text-sm text-blue-900/80">
            Tu as envoyé ta candidature ? Marque-la comme envoyée pour lancer le suivi et les
            rappels de relance.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="sent_on" className="mb-1 block text-xs font-medium text-blue-900">
              Envoyée le
            </label>
            <input
              id="sent_on"
              name="sent_on"
              type="date"
              defaultValue={today}
              max={today}
              required
              className="input py-2 sm:w-auto"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {pending ? "Enregistrement…" : "✉️ Marquer comme envoyée"}
          </button>
        </div>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </section>
  );
}
