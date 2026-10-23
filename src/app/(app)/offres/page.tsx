import type { Metadata } from "next";
import Link from "next/link";

import { IconBriefcase, IconClock, IconMapPin, IconSearch } from "@/components/icons";
import { CompanyLogo } from "@/components/offers/company-logo";
import { OfferDetails } from "@/components/offers/offer-details";
import { OfferLink } from "@/components/offers/offer-link";
import { RecommendationsToggle } from "@/components/offers/recommendations-toggle";
import { requireUser } from "@/lib/auth";
import { getSectors, isFranceTravailConfigured, type ReferenceItem } from "@/lib/france-travail";
import type { Department } from "@/lib/geo";
import { findCompanyDomain, getCompanyLogo, isJobBoardOfferId } from "@/lib/job-boards";
import { getRecommendationBasis } from "@/lib/offer-recommendations";
import {
  CONTRACT_FILTERS,
  OFFER_SOURCES,
  OfferSourceError,
  type OfferListing,
  type OfferSource,
  type OfferSearch,
} from "@/lib/offer-types";
import {
  findOffer,
  hasOfferQuery,
  isOfferId,
  isOfferSearchConfigured,
  offerQueryParams,
  readOfferQuery,
  resolveOfferSearch,
  searchAllOffers,
  type CombinedSearchResult,
  type OfferQuery,
} from "@/lib/offers";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trouver une offre — Applyfy" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
const numberFormatter = new Intl.NumberFormat("fr-FR");

/** Logo de la source, à défaut de celui de l'entreprise (offres des pages carrières : initiales). */
const SOURCE_LOGOS: Partial<Record<OfferSource, string>> = {
  "france-travail": "/images/france-travail.png",
  adzuna: "/images/adzuna.png",
};

function publishedLabel(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Publiée aujourd'hui";
  if (days === 1) return "Publiée hier";
  if (days < 7) return `Publiée il y a ${days} jours`;
  return `Publiée le ${dateFormatter.format(new Date(iso))}`;
}

export default async function OffersPage({ searchParams }: PageProps<"/offres">) {
  if (isSupabaseConfigured()) await requireUser();
  const params = await searchParams;
  /** Recherche saisie dans le formulaire. */
  const manualQuery = readOfferQuery(params);
  const { keywords, place, contract, sector } = manualQuery;
  const hasManualSearch = hasOfferQuery(manualQuery);
  /** Offre affichée dans le panneau de détails (?offre=). */
  const selectedId = isOfferId(params.offre) ? params.offre : null;
  const configured = isOfferSearchConfigured();

  // Recommandations personnalisées (?reco=1, sans recherche manuelle) : recherche
  // construite à partir des candidatures de l'utilisateur.
  const recommending = configured && params.reco === "1" && !hasManualSearch;
  const basis = recommending
    ? await getRecommendationBasis().catch((e) => {
        console.error("[offres] recommandations", e);
        return null;
      })
    : null;
  const query: OfferQuery = basis
    ? { keywords: basis.keywords, place: basis.place, contract: basis.contract, sector: null, page: manualQuery.page }
    : manualQuery;
  const { page } = query;
  const hasSearch = recommending ? basis !== null : hasManualSearch;

  let sectors: ReferenceItem[] = [];
  let search: OfferSearch | null = null;
  let department: Department | null = null;
  let result: CombinedSearchResult | null = null;
  let error: string | null = null;

  if (configured) {
    // Filtres : sans secteurs (France Travail absent ou indisponible), la recherche reste possible.
    if (isFranceTravailConfigured()) {
      sectors = await getSectors().catch((e) => {
        console.error("[offres] secteurs", e);
        return [];
      });
    }
    if (hasSearch) {
      ({ search, department } = await resolveOfferSearch(query));
      if (!search) {
        error = `Localisation « ${place} » introuvable : indique une ville ou un numéro de département (ex. Lyon, 69).`;
      } else {
        try {
          result = await searchAllOffers(search);
        } catch (e) {
          if (!(e instanceof OfferSourceError)) console.error("[offres] recherche", e);
          error = e instanceof OfferSourceError ? e.message : "La recherche a échoué. Réessaie dans un instant.";
        }
      }
    }
  }

  // Offre sélectionnée : déjà dans les résultats, sinon lue à part (lien partagé, page changée).
  // Une offre de page carrières est toujours relue : la liste n'a pas sa description.
  let selected: OfferListing | null = null;
  let selectedMissing = false;
  if (configured && selectedId) {
    selected = isJobBoardOfferId(selectedId) ? null : (result?.offers.find((offer) => offer.id === selectedId) ?? null);
    if (!selected) {
      selected = await findOffer(selectedId, search).catch((e) => {
        if (!(e instanceof OfferSourceError)) console.error("[offres] détail", e);
        return null;
      });
      selectedMissing = !selected;
    }
  }

  const pageCount = result?.pageCount ?? 0;
  const logoOf = (company: string | null) => {
    const domain = findCompanyDomain(company);
    return domain && getCompanyLogo(domain);
  };
  /** Recherche effectuée (mots-clés recommandés compris), pour retrouver une offre à l'ajout. */
  const searchParamsOf = (target: number) => offerQueryParams({ ...query, page: target });
  const href = (target: number, offre: string | null = null) => {
    // En mode recommandations, l'URL garde ?reco=1 : la recherche est recalculée côté serveur.
    const params = recommending ? new URLSearchParams({ reco: "1" }) : searchParamsOf(target);
    if (recommending && target > 1) params.set("page", String(target));
    if (offre) params.set("offre", offre);
    return `/offres?${params}`;
  };
  // Sur mobile, l'offre sélectionnée s'affiche seule (page dédiée) : le reste est masqué.
  const mobileHidden = selected ? "max-lg:hidden" : "";

  const label = "text-sm font-medium text-slate-700 dark:text-slate-200";
  return (
    <main
      className={`mx-auto w-full ${result || selected ? "max-w-7xl" : "max-w-5xl"} flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Trouver une offre</h1>
        <p className="mt-1.5 text-slate-500 dark:text-slate-400">
          Trouve ton prochain job et ajoute-le en un clic à tes candidatures.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Cette section est encore en cours de développement — le catalogue d&apos;offres est incomplet.
        </p>
      </div>

      {configured && (
        <div className={mobileHidden}>
          <RecommendationsToggle active={recommending} canAutoOpen={!hasManualSearch && !selectedId}>
            {basis && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Basées sur tes candidatures : « {basis.keywords} »
                {department ? ` · ${department.name}` : basis.place ? ` · ${basis.place}` : " · toute la France"}
                {basis.contract ? ` · ${CONTRACT_FILTERS[basis.contract]}` : ""}
              </p>
            )}
          </RecommendationsToggle>
        </div>
      )}

      {!configured ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-400">
          La recherche d&apos;offres n&apos;est pas encore configurée sur ce site (identifiants des
          API France Travail et Adzuna manquants).
        </p>
      ) : (
        <form action="/offres" role="search" className={`card space-y-4 p-5 ${mobileHidden}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="offres-q" className={label}>
                Mot-clé
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="offres-q"
                  name="q"
                  type="search"
                  defaultValue={keywords}
                  maxLength={120}
                  placeholder="Poste, métier, compétence…"
                  className="input py-2.5 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="offres-lieu" className={label}>
                Localisation
              </label>
              <div className="relative">
                <IconMapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="offres-lieu"
                  name="lieu"
                  type="text"
                  defaultValue={place}
                  maxLength={80}
                  placeholder="Ville ou département (ex. Lyon, 69)"
                  className="input py-2.5 pl-9"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <label htmlFor="offres-contrat" className={label}>
                Type de contrat
              </label>
              <select id="offres-contrat" name="contrat" defaultValue={contract ?? ""} className="input py-2.5">
                <option value="">Tous les contrats</option>
                {Object.entries(CONTRACT_FILTERS).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="offres-secteur" className={label}>
                Secteur
              </label>
              <select
                id="offres-secteur"
                name="secteur"
                defaultValue={sector ?? ""}
                disabled={sectors.length === 0}
                className="input py-2.5"
              >
                <option value="">Tous les secteurs</option>
                {sectors.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.libelle}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary px-6 py-2.5 text-sm">
              <IconSearch className="h-4 w-4" />
              Rechercher
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-500/15 px-4 py-3 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30">
          {error}
        </p>
      )}

      {result?.warning && (
        <p role="status" className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-400">
          {result.warning}
        </p>
      )}

      {selectedMissing && (
        <p role="status" className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-400">
          Cette offre n&apos;est plus disponible.
        </p>
      )}

      {recommending && !basis && !selected && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="font-medium text-slate-900 dark:text-white">
            Ajoute des candidatures pour recevoir des recommandations personnalisées
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Les offres recommandées s&apos;appuient sur les postes et les villes de tes candidatures
            envoyées (les brouillons ne sont pas pris en compte).
          </p>
          <Link href="/candidatures/nouvelle" className="btn-primary mt-4 inline-flex px-4 py-2 text-sm">
            Ajouter une candidature
          </Link>
        </div>
      )}

      {configured && !hasSearch && !recommending && !selected && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="font-medium text-slate-900 dark:text-white">Lance ta recherche</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Indique un poste, une ville ou un type de contrat pour voir les offres correspondantes.
          </p>
        </div>
      )}

      {(result || selected) && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {result && (
            <section aria-labelledby="offres-resultats" className={`space-y-4 ${mobileHidden}`}>
              <h2 id="offres-resultats" className="text-sm text-slate-600 dark:text-slate-300">
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {numberFormatter.format(result.total)} offre{result.total > 1 ? "s" : ""}
                </strong>
                {department && <> · {department.name}</>}
                {result.truncated && " · affine ta recherche pour voir les plus pertinentes"}
              </h2>

              {result.offers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                  {recommending ? (
                    <>
                      <p className="font-medium text-slate-900 dark:text-white">
                        Aucune recommandation trouvée — essaie une recherche manuelle
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Utilise le formulaire ci-dessus avec d&apos;autres mots-clés ou une autre ville.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-900 dark:text-white">Aucune offre ne correspond</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Essaie d&apos;autres mots-clés ou retire un filtre.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="space-y-4">
                  {result.offers.map((offer) => {
                    const isSelected = offer.id === selected?.id;
                    // Localisation · date · contrat : une ligne discrète sous l'entreprise.
                    const details = [
                      offer.location && { icon: IconMapPin, text: offer.location },
                      offer.publishedAt && { icon: IconClock, text: publishedLabel(offer.publishedAt) },
                      offer.contract && { icon: IconBriefcase, text: offer.contract },
                    ].filter((d): d is { icon: typeof IconMapPin; text: string } => Boolean(d && d.text));
                    return (
                      <li key={offer.id}>
                        <OfferLink
                          href={href(page, offer.id)}
                          selected={isSelected}
                          className={`card block p-5 transition sm:p-6 ${
                            isSelected ? "bg-blue-50/60 ring-2 ring-blue-500" : "hover:ring-1 hover:ring-blue-300"
                          }`}
                        >
                          <h3 className="text-lg leading-snug font-bold text-slate-900 dark:text-white">{offer.title}</h3>
                          <div className="mt-2 flex items-center gap-3">
                            <CompanyLogo
                              name={offer.company}
                              src={logoOf(offer.company)}
                              fallbackSrc={SOURCE_LOGOS[offer.source]}
                            />
                            <p className="min-w-0 text-[15px] font-medium text-slate-700 dark:text-slate-200">
                              {offer.company ?? "Entreprise non communiquée"}
                            </p>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              {details.map(({ icon: Icon, text }) => (
                                <li key={text} className="inline-flex items-center gap-1">
                                  <Icon className="h-3.5 w-3.5 text-slate-300" />
                                  {text}
                                </li>
                              ))}
                            </ul>
                            <span className="shrink-0 rounded-full bg-[#F9FAFB] dark:bg-slate-800 px-2 py-0.5 text-[11px] text-[#6B7280] dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">
                              <span className="sr-only">Source : </span>
                              {OFFER_SOURCES[offer.source]}
                            </span>
                          </div>
                        </OfferLink>
                      </li>
                    );
                  })}
                </ul>
              )}

              {pageCount > 1 && (
                <nav aria-label="Pages de résultats" className="flex items-center justify-between pt-2 text-sm">
                  {page > 1 ? (
                    <Link href={href(page - 1)} className="btn-secondary px-4 py-2">
                      ← Précédent
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-slate-500 dark:text-slate-400">
                    Page {page} sur {numberFormatter.format(pageCount)}
                  </span>
                  {page < pageCount ? (
                    <Link href={href(page + 1)} className="btn-secondary px-4 py-2">
                      Suivant →
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </section>
          )}

          {selected ? (
            <div className={result ? "" : "lg:col-span-2"}>
              <OfferDetails
                key={selected.id}
                offer={selected}
                backHref={href(page)}
                search={searchParamsOf(page).toString()}
              />
            </div>
          ) : (
            result &&
            result.offers.length > 0 && (
              <div className="hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center lg:sticky lg:top-6 lg:block">
                <p className="font-medium text-slate-900 dark:text-white">Sélectionne une offre</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Ses détails s&apos;afficheront ici : description, salaire, profil recherché.
                </p>
              </div>
            )
          )}
        </div>
      )}

    </main>
  );
}
