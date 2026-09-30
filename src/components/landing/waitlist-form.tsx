"use client";

import { useActionState } from "react";

import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";

const initialState: WaitlistState = { status: "idle" };

export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-xl bg-white/10 px-4 py-3 text-center font-medium text-white ring-1 ring-white/20"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Adresse email
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ton.email@ecole.fr"
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "error" ? "waitlist-error" : undefined}
          className="min-w-0 flex-1 rounded-lg border-0 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Inscription…" : "Rejoindre la liste d'attente"}
        </button>
      </div>
      {state.status === "error" && (
        <p id="waitlist-error" role="alert" className="mt-2 text-sm text-rose-200">
          {state.message}
        </p>
      )}
    </form>
  );
}
