import Link from "next/link";

import type { Sector } from "@/lib/cv-sector-context";
import { getOffersForYou } from "@/lib/dashboard-offers";
import { offerImportHref, type AppliedOffer } from "@/lib/offers-for-you";

/** « Offres pour toi » : masqué s'il y a moins de 3 offres pertinentes. Rendu dans un Suspense. */
export async function OffersForYou({
  sector,
  targetJob,
  applied,
}: {
  sector: Sector;
  targetJob: string;
  applied: AppliedOffer[];
}) {
  const offers = await getOffersForYou(sector, targetJob, applied);
  if (offers.length === 0) return null;

  return (
    <section aria-labelledby="offers-title" className="ui-card p-5 sm:p-6">
      <h2 id="offers-title" className="text-lg font-semibold tracking-title text-ink dark:text-white">
        Offres pour toi
      </h2>
      <ul className="mt-1">
        {offers.map((offer) => (
          <li
            key={offer.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft py-3.5 first:border-t-0 dark:border-slate-800"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-semibold break-words text-ink dark:text-white">{offer.title}</p>
              <p className="text-sm break-words text-muted dark:text-slate-300">{offer.company}</p>
            </div>
            <Link
              href={offerImportHref(offer.url)}
              prefetch={false}
              aria-label={`Importer l'offre ${offer.title} chez ${offer.company}`}
              className="ui-btn-secondary w-full px-4 sm:w-auto"
            >
              Importer l&apos;offre
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
