"use client";

import { useActionState } from "react";

import { addOfferToApplicationsAction, type AddOfferState } from "@/app/actions/job-offers";
import { IconPlus } from "@/components/icons";

const initialState: AddOfferState = { status: "idle" };

/** « Ajouter à mes candidatures » : crée la candidature puis ouvre sa fiche. */
export function AddOfferButton({ offerId, title }: { offerId: string; title: string }) {
  const [state, formAction, pending] = useActionState(addOfferToApplicationsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="offerId" value={offerId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Ajouter « ${title} » à mes candidatures`}
        className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
      >
        <IconPlus className="h-4 w-4" />
        {pending ? "Ajout…" : "Ajouter à mes candidatures"}
      </button>
      {state.status === "error" && !pending && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
