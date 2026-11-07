"use client";

import { OFFER_SORTS, type OfferSort } from "@/lib/offer-types";

/** Tri des résultats, discret, sous les filtres : relance la recherche dès qu'il change. */
export function SortSelect({ defaultValue }: { defaultValue: OfferSort }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted dark:text-slate-400">
      <label htmlFor="offres-tri">Trier par</label>
      <select
        id="offres-tri"
        name="tri"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="ui-focus min-h-11 rounded-full border border-line-strong bg-white py-1 pr-7 pl-3 text-[13px] text-ink transition lg:min-h-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
