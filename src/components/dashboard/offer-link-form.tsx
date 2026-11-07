import Form from "next/form";

import { OFFER_URL_MAX_LENGTH } from "@/lib/offer-limits";

/** Champ « Colle le lien d'une offre » : ouvre le formulaire de candidature, qui lance l'import. */
export function OfferLinkForm() {
  return (
    <Form action="/candidatures/nouvelle" className="card p-4 sm:p-5">
      <label htmlFor="offer-link" className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Colle le lien d&apos;une offre
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="offer-link"
          name="lien"
          type="url"
          inputMode="url"
          required
          maxLength={OFFER_URL_MAX_LENGTH}
          placeholder="https://…"
          className="input min-h-11 min-w-0 flex-1"
        />
        <button type="submit" className="btn-primary min-h-11 px-5 text-sm">
          Importer l&apos;offre
        </button>
      </div>
    </Form>
  );
}
