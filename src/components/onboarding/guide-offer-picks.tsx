"use client";

import { useActionState, useState } from "react";

import { addOfferToApplicationsAction, type AddOfferState } from "@/app/actions/job-offers";
import { frenchSpaces } from "@/lib/onboarding-guide";
import { GUIDE_TEXTS } from "@/lib/lumeo-texts";
import type { GuideOfferPick } from "@/lib/guide-offer-picks";

const initialState: AddOfferState = { status: "idle" };

/**
 * Écran de l'offre de la phase guidée : 3 offres proposées par Lumeo d'après le métier du CV.
 * « Ajouter » crée la candidature (accueil=1 : fin du parcours, bandeau de Lumeo sur la fiche).
 * Pendant un ajout, tous les boutons sont désactivés (pas de double candidature) ; le champ du
 * lien et « Trouver une offre » restent utilisables.
 */
export function GuideOfferPickList({ picks }: { picks: GuideOfferPick[] }) {
  const [state, formAction, pending] = useActionState(addOfferToApplicationsAction, initialState);
  const [chosen, setChosen] = useState<string | null>(null);
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="guide-picks-title" className="ob-rise-2 w-full">
      <h2 id="guide-picks-title" className="text-center text-lg font-semibold text-ink">
        {frenchSpaces(GUIDE_TEXTS.picksTitle)}
      </h2>
      <p className="mt-1 text-center text-sm text-muted">{frenchSpaces(GUIDE_TEXTS.picksSubtitle)}</p>
      <p aria-live="polite" className="sr-only">
        {pending ? GUIDE_TEXTS.pickAdding : ""}
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {picks.map((pick) => {
          const details = [pick.company, pick.location].filter(Boolean).join(" · ");
          return (
            <li
              key={pick.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold break-words text-ink">{pick.title}</p>
                {details && <p className="mt-0.5 text-sm break-words text-muted">{details}</p>}
                {state.status === "error" && !pending && chosen === pick.id && (
                  <p role="alert" className="mt-1 text-sm text-red-600">
                    {state.message}
                  </p>
                )}
              </div>
              <form action={formAction} onSubmit={() => setChosen(pick.id)} className="w-full shrink-0 sm:w-auto">
                <input type="hidden" name="offerId" value={pick.id} />
                <input type="hidden" name="search" value={pick.search} />
                <input type="hidden" name="accueil" value="1" />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={`${GUIDE_TEXTS.pickAdd} « ${pick.title} »${pick.company ? ` chez ${pick.company}` : ""}`}
                  className="ui-btn-primary min-h-11 w-full sm:w-auto"
                >
                  {pending && chosen === pick.id ? GUIDE_TEXTS.pickAdding : GUIDE_TEXTS.pickAdd}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
