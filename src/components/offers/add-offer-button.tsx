"use client";

import { useActionState } from "react";

import { addOfferToApplicationsAction, type AddOfferState } from "@/app/actions/job-offers";
import { IconPlus } from "@/components/icons";

const initialState: AddOfferState = { status: "idle" };

/** « Ajouter à mes candidatures » : crée la candidature puis ouvre sa fiche. */
export function AddOfferButton({
  offerId,
  search,
  title,
  className = "items-start sm:items-end",
}: {
  offerId: string;
  /** Paramètres d'URL de la recherche où l'offre a été vue (pour retrouver une offre Adzuna). */
  search: string;
  title: string;
  /** Alignement du bouton et du message d'erreur. */
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(addOfferToApplicationsAction, initialState);

  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="search" value={search} />
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
