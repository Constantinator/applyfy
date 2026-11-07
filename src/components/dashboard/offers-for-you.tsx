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
    <section aria-labelledby="offers-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="offers-title" className="ui-title">
          Offres pour toi
        </h2>
        <Link href="/offres" className="ui-link inline-flex min-h-11 items-center text-sm">
          Voir plus d&apos;offres →
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
        {offers.map((offer) => (
          <li
            key={offer.id}
            className="flex min-w-0 flex-col items-start rounded-card border border-line bg-surface p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white text-lg font-bold text-ink dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {offer.company.charAt(0).toUpperCase()}
            </span>
            <p className="mt-3 text-base font-semibold break-words text-ink dark:text-white">{offer.title}</p>
            <p className="mt-0.5 text-[13px] break-words text-muted dark:text-slate-300">{offer.company}</p>
            <Link
              href={offerImportHref(offer.url)}
              prefetch={false}
              aria-label={`Importer l'offre ${offer.title} chez ${offer.company}`}
              className="ui-btn-secondary mt-4"
            >
              Importer l&apos;offre
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
