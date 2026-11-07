import Form from "next/form";

import { OFFER_URL_MAX_LENGTH } from "@/lib/offer-limits";

/** Champ « Colle le lien d'une offre » : ouvre le formulaire de candidature, qui lance l'import. */
export function OfferLinkForm() {
  return (
    <Form action="/candidatures/nouvelle" className="ui-card p-4 sm:p-5">
      <label htmlFor="offer-link" className="text-sm font-medium text-ink dark:text-slate-200">
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
          className="ui-input min-h-11 min-w-0 flex-1"
        />
        <button type="submit" className="ui-btn-primary px-5">
          Importer l&apos;offre
        </button>
      </div>
    </Form>
  );
}
