"use client";

import { useActionState } from "react";

import { updateStatusAction, type ActionState } from "@/app/actions/applications";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

const initialState: ActionState = { status: "idle" };

export function StatusChanger({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
}) {
  const [state, formAction, pending] = useActionState(updateStatusAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={applicationId} />
      <label htmlFor="status" className="text-sm font-medium text-slate-700">
        Statut de la candidature
      </label>
      <div className="flex gap-2">
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "…" : "Changer le statut"}
        </button>
      </div>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm ${state.status === "error" ? "text-rose-600" : "text-emerald-700"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
