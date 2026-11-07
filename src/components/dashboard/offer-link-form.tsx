import Form from "next/form";

import { OFFER_URL_MAX_LENGTH } from "@/lib/offer-limits";

/** Champ « Colle le lien d'une offre » : ouvre le formulaire de candidature, qui lance l'import. */
export function OfferLinkForm() {
  return (
    <Form
      action="/candidatures/nouvelle"
      className="flex w-full items-center rounded-full border border-line-strong bg-white py-1.5 pr-1.5 pl-5 transition-shadow focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/20 lg:w-[460px] lg:shrink-0 dark:border-slate-700 dark:bg-slate-900"
    >
      <input
        id="offer-link"
        name="lien"
        type="url"
        inputMode="url"
        required
        maxLength={OFFER_URL_MAX_LENGTH}
        aria-label="Colle le lien d'une offre"
        placeholder="Colle le lien d'une offre"
        // 16 px sur mobile : pas de zoom automatique sur iOS.
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-sm placeholder:text-muted placeholder-shown:text-ellipsis sm:text-sm dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      <button type="submit" className="ui-btn-primary ml-2 shrink-0">
        Importer l&apos;offre
      </button>
    </Form>
  );
}
