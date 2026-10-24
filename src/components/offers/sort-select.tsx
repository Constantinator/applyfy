"use client";

import { OFFER_SORTS, type OfferSort } from "@/lib/offer-types";

/** Tri des résultats, discret, sous les filtres : relance la recherche dès qu'il change. */
export function SortSelect({ defaultValue }: { defaultValue: OfferSort }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
      <label htmlFor="offres-tri">Trier par</label>
      <select
        id="offres-tri"
        name="tri"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-200 bg-white py-1 pr-7 pl-2 text-xs text-slate-600 transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        {Object.entries(OFFER_SORTS).map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
