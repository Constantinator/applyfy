import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { IconBriefcase, IconClock, IconMapPin, IconSearch } from "@/components/icons";
import { CompanyLogo } from "@/components/company-logo";
import { OfferDetails } from "@/components/offers/offer-details";
import { OfferLink } from "@/components/offers/offer-link";
import { RecentSearchRecorder } from "@/components/offers/recent-search-recorder";
import { RecommendationsToggle } from "@/components/offers/recommendations-toggle";
import { SortSelect } from "@/components/offers/sort-select";
import { SectorPill } from "@/components/sector-pill";
import { requireUser } from "@/lib/auth";
import { detectOfferSector } from "@/lib/cv-sector-context";
import type { Department } from "@/lib/geo";
import { loadCompanyDomains } from "@/lib/company-domains-store";
import { logLogoCoverage } from "@/lib/company-domain";
import { KNOWN_COMPANY_DOMAINS, companyLogo } from "@/lib/company-logos";
import { getLatestBuilderCv } from "@/lib/cv-builder";
import { targetJobOf } from "@/lib/cv-builder-types";
import { isJobBoardOfferId } from "@/lib/job-boards";
import { LumeoAvatar } from "@/components/lumeo/lumeo-avatar";
import { OFFERS_LUMEO_TEXTS } from "@/lib/lumeo-texts";
import { spreadRepeats } from "@/lib/offer-merge";
import { shouldFallBackToLatest } from "@/lib/offer-reco-rules";
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
  latestOffersSearch,
  resolveOfferSearch,
  searchAllOffers,
  searchLatestOffers,
  type CombinedSearchResult,
  type OfferQuery,
} from "@/lib/offers";
import { RECENT_SEARCHES_COOKIE, parseRecentSearches } from "@/lib/recent-searches";
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

/**
 * Métier visé du dernier CV (« Quel poste vises-tu ? », import, sinon intitulé du CV), ou null.
 * Sans échec : sans CV ou si la lecture échoue, null (les dernières offres s'affichent).
 */
async function latestCvTargetJob(): Promise<string | null> {
  try {
    const cv = await getLatestBuilderCv();
    const job = cv ? (targetJobOf(cv.data) || cv.data.personal.jobTitle).trim() : "";
    return job.length >= 2 ? job : null;
  } catch (error) {
    console.error("[offres] métier du dernier CV", error);
    return null;
  }
}

export default async function OffersPage({ searchParams }: PageProps<"/offres">) {
  if (isSupabaseConfigured()) await requireUser();
  const params = await searchParams;
  /** Recherche saisie dans le formulaire. */
  const manualQuery = readOfferQuery(params);
  const { keywords, place, contract, sort } = manualQuery;
  const hasManualSearch = hasOfferQuery(manualQuery);
  /** Offre affichée dans le panneau de détails (?offre=). */
  const selectedId = isOfferId(params.offre) ? params.offre : null;
  const configured = isOfferSearchConfigured();

  // Sans recherche manuelle : recommandations (?reco=1, ou par défaut si le métier du dernier CV
  // est connu), sinon les dernières offres publiées. ?reco=0 : recommandations coupées.
  const explicitReco = params.reco === "1";
  const recoOff = params.reco === "0";
  const cvTargetJob = configured && !hasManualSearch && !recoOff ? await latestCvTargetJob() : null;
  const wantsReco = configured && !hasManualSearch && (explicitReco || (!recoOff && cvTargetJob !== null));
  const recentSearches = wantsReco ? parseRecentSearches((await cookies()).get(RECENT_SEARCHES_COOKIE)?.value) : [];
  const basis = wantsReco
    ? await getRecommendationBasis(recentSearches, cvTargetJob).catch((e) => {
        console.error("[offres] recommandations", e);
        return null;
      })
    : null;
  // Recommandations par défaut sans base exploitable : les dernières offres, plutôt qu'un écran vide.
  const recommending = wantsReco && (explicitReco || basis !== null);
  const showingLatest = configured && !hasManualSearch && !recommending;
  const query: OfferQuery = basis
    ? {
        keywords: basis.keywords,
        place: basis.place,
        contract: basis.contract,
        // Pertinence : les offres d'un même cabinet (même intitulé, plusieurs régions) ne
        // remplissent plus la page comme avec le tri par date.
        sort: "pertinence",
        sortChosen: false,
        page: manualQuery.page,
      }
    : manualQuery;
  const { page } = query;
  const hasSearch = recommending ? basis !== null : hasManualSearch || showingLatest;

  let search: OfferSearch | null = null;
  let department: Department | null = null;
  let result: CombinedSearchResult | null = null;
  let error: string | null = null;

  if (showingLatest) {
    // Dernières offres publiées : résultat commun, en cache 15 minutes par source (lib/offers).
    search = latestOffersSearch(page);
    try {
      result = await searchLatestOffers(page);
    } catch (e) {
      if (!(e instanceof OfferSourceError)) console.error("[offres] dernières offres", e);
      error = e instanceof OfferSourceError ? e.message : "Les offres n'ont pas pu être chargées. Réessaie dans un instant.";
    }
  } else if (configured) {
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

  // Recommandations sans aucune offre : les dernières offres publiées à la place (jamais de page à
  // 0 offre quand des offres existent). Pas de bascule si France Travail a échoué (même attente).
  let recoFallback = false;
  if (recommending && shouldFallBackToLatest(result)) {
    try {
      const latest = await searchLatestOffers(page);
      search = latestOffersSearch(page);
      department = null;
      result = latest;
      recoFallback = true;
    } catch (e) {
      if (!(e instanceof OfferSourceError)) console.error("[offres] dernières offres (recommandations vides)", e);
    }
  }

  // Recommandations et dernières offres : au plus 2 cartes par employeur et intitulé en tête de
  // page, le reste après (rien de perdu). Recherche manuelle : ordre demandé, inchangé.
  if (result && (recommending || showingLatest)) result = { ...result, offers: spreadRepeats(result.offers) };

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
  // Domaines de la table partagée pour les entreprises affichées (une seule requête).
  const sharedDomains = await loadCompanyDomains([...(result?.offers ?? []).map((offer) => offer.company), selected?.company]);
  // Mesure de la couverture des logos : nombres seulement, en mémoire, sans requête ni délai.
  if (result) logLogoCoverage(result.offers, KNOWN_COMPANY_DOMAINS, sharedDomains);
  /** Logo de l'entreprise (liste vérifiée, table partagée, sinon site de l'offre hors plateformes), ou null. */
  const logoOf = (offer: OfferListing, size: 36 | 48) => companyLogo({ name: offer.company, offerUrl: offer.url }, size, sharedDomains);
  /** Recherche effectuée (mots-clés recommandés compris), pour retrouver une offre à l'ajout. */
  const searchParamsOf = (target: number) => offerQueryParams({ ...query, page: target });
  const href = (target: number, offre: string | null = null) => {
    // En mode recommandations, l'URL garde ?reco=1 : la recherche est recalculée côté serveur.
    // Dernières offres : rien de plus (sauf ?reco=0, gardé pour ne pas rouvrir les recommandations).
    const params = recommending
      ? new URLSearchParams({ reco: "1" })
      : showingLatest
        ? new URLSearchParams(recoOff ? { reco: "0" } : {})
        : searchParamsOf(target);
    if ((recommending || showingLatest) && target > 1) params.set("page", String(target));
    if (offre) params.set("offre", offre);
    return `/offres?${params}`;
  };
  // Sur mobile, l'offre sélectionnée s'affiche seule (page dédiée) : le reste est masqué.
  const mobileHidden = selected ? "max-lg:hidden" : "";

  const label = "sr-only";
  return (
    <div className="flex flex-1 flex-col bg-page dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        <div>
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">Trouver une offre</h1>
          <p className="mt-1.5 text-muted dark:text-slate-400">
            Trouve ton prochain job et ajoute-le en un clic à tes candidatures.
          </p>
          <p className="mt-1 text-xs text-muted">
            Cette section est encore en cours de développement — le catalogue d&apos;offres est incomplet.
          </p>
        </div>

        {/* Recherche valide : mémorisée pour les recommandations. */}
        {!recommending && hasManualSearch && search && (
          <RecentSearchRecorder keywords={keywords} place={place} contract={contract} />
        )}

        {configured && (
          <div className={mobileHidden}>
            <RecommendationsToggle
              active={recommending}
              fromLink={explicitReco}
              urlChoice={explicitReco || recoOff}
              canAutoOpen={!hasManualSearch && !selectedId && !recoOff}
            />
          </div>
        )}

        {!configured ? (
          <p className="ui-notice px-4 py-3 text-sm">
            La recherche d&apos;offres n&apos;est pas encore configurée sur ce site (identifiants des
            API France Travail et Adzuna manquants).
          </p>
        ) : (
          <form action="/offres" role="search" className={`space-y-3 ${mobileHidden}`}>
            {/* Filtres principaux, bien visibles ; le tri, secondaire, en dessous. */}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-center">
              <div className="space-y-1.5">
                <label htmlFor="offres-q" className={label}>
                  Mot-clé
                </label>
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    id="offres-q"
                    name="q"
                    type="search"
                    defaultValue={keywords}
                    maxLength={120}
                    placeholder="Poste, métier, compétence…"
                    className="ui-input rounded-full pl-11 text-base sm:text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="offres-lieu" className={label}>
                  Localisation
                </label>
                <div className="relative">
                  <IconMapPin className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    id="offres-lieu"
                    name="lieu"
                    type="text"
                    defaultValue={place}
                    maxLength={80}
                    placeholder="Ville ou département (ex. Lyon, 69)"
                    className="ui-input rounded-full pl-11 text-base sm:text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="offres-contrat" className={label}>
                  Type de contrat
                </label>
                <select id="offres-contrat" name="contrat" defaultValue={contract ?? ""} className="ui-input rounded-full text-base sm:text-sm">
                  <option value="">Tous les contrats</option>
                  {Object.entries(CONTRACT_FILTERS).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="ui-btn-primary">
                <IconSearch className="h-4 w-4" />
                Rechercher
              </button>
            </div>
            <SortSelect defaultValue={sort} chosen={manualQuery.sortChosen} />
          </form>
        )}

        {error && (
          <p role="alert" className="ui-notice-error px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {result?.warning && (
          <p role="status" className="ui-notice px-4 py-3 text-sm">
            {result.warning}
          </p>
        )}

        {selectedMissing && (
          <p role="status" className="ui-notice px-4 py-3 text-sm">
            Cette offre n&apos;est plus disponible.
          </p>
        )}

        {recommending && !basis && !selected && (
          <div className="rounded-card border border-dashed border-line-strong dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
            <p className="font-medium text-ink dark:text-white">
              Fais une recherche ou ajoute des candidatures pour recevoir des recommandations personnalisées
            </p>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Les offres recommandées s&apos;appuient sur tes recherches récentes et sur les postes et les
              villes de tes candidatures envoyées (les brouillons ne sont pas pris en compte).
            </p>
            <Link href="/candidatures/nouvelle" className="ui-btn-primary mt-4 inline-flex">
              Ajouter une candidature
            </Link>
          </div>
        )}

        {configured && !hasSearch && !recommending && !selected && (
          <div className="rounded-card border border-dashed border-line-strong dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
            <p className="font-medium text-ink dark:text-white">Lance ta recherche</p>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              Indique un poste, une ville ou un type de contrat pour voir les offres correspondantes.
            </p>
          </div>
        )}

        {recoFallback && (
          // Recommandations vides : Lumeo le dit, puis les dernières offres publiées.
          <div role="status" className={`flex items-center gap-3 ${mobileHidden}`}>
            <LumeoAvatar size={36} expression="reflechit" standalone />
            <p className="text-sm text-ink dark:text-slate-200">{OFFERS_LUMEO_TEXTS.recoEmpty}</p>
          </div>
        )}

        {(result || selected) && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            {result && (
              <section aria-labelledby="offres-resultats" className={`space-y-3 ${mobileHidden}`}>
                <h2 id="offres-resultats" className="text-sm text-muted dark:text-slate-300">
                  {(showingLatest || recoFallback) && (
                    <span className="font-semibold text-ink dark:text-white">Dernières offres publiées · </span>
                  )}
                  <strong className="font-semibold text-ink dark:text-white">
                    {numberFormatter.format(result.total)} offre{result.total > 1 ? "s" : ""}
                  </strong>
                  {department && <> · {department.name}</>}
                  {result.truncated && " · affine ta recherche pour voir les plus pertinentes"}
                </h2>

                {result.offers.length === 0 ? (
                  <div className="rounded-card border border-dashed border-line-strong dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                    {recommending ? (
                      <>
                        <p className="font-medium text-ink dark:text-white">
                          Aucune recommandation trouvée — essaie une recherche manuelle
                        </p>
                        <p className="mt-1 text-sm text-muted dark:text-slate-400">
                          Utilise le formulaire ci-dessus avec d&apos;autres mots-clés ou une autre ville.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-ink dark:text-white">Aucune offre ne correspond</p>
                        <p className="mt-1 text-sm text-muted dark:text-slate-400">
                          Essaie d&apos;autres mots-clés ou retire un filtre.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <ul className="ui-card overflow-hidden">
                    {result.offers.map((offer) => {
                      const isSelected = offer.id === selected?.id;
                      // Localisation · date · contrat : une ligne discrète sous l'entreprise.
                      const details = [
                        offer.location && { icon: IconMapPin, text: offer.location },
                        offer.publishedAt && { icon: IconClock, text: publishedLabel(offer.publishedAt) },
                        offer.contract && { icon: IconBriefcase, text: offer.contract },
                      ].filter((d): d is { icon: typeof IconMapPin; text: string } => Boolean(d && d.text));
                      return (
                        <li key={offer.id} className="border-t border-line-soft first:border-t-0 dark:border-slate-800">
                          <OfferLink
                            href={href(page, offer.id)}
                            selected={isSelected}
                            className={`ui-focus flex items-start gap-3.5 px-[18px] py-4 transition ${
                              isSelected ? "bg-[#F7F7F8] dark:bg-slate-800" : "hover:bg-surface dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <CompanyLogo
                              name={offer.company}
                              src={logoOf(offer, 36)}
                              fallbackSrc={SOURCE_LOGOS[offer.source]}
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[15px] leading-snug font-semibold text-ink dark:text-white">{offer.title}</h3>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted dark:text-slate-300">
                                <span className="min-w-0 break-words">{offer.company ?? "Entreprise non communiquée"}</span>
                                {/* Secteur calculé au titre et à la description (null → « Autre »). */}
                                <SectorPill sector={detectOfferSector(offer.title, offer.description)} />
                              </p>
                            <div className="mt-1.5 flex items-end justify-between gap-3">
                              <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                                {details.map(({ icon: Icon, text }) => (
                                  <li key={text} className="inline-flex items-center gap-1">
                                    <Icon className="h-3.5 w-3.5 text-muted" />
                                    {text}
                                  </li>
                                ))}
                              </ul>
                              <span className="shrink-0 rounded-full bg-box px-2 py-0.5 text-[11px] text-muted dark:bg-slate-800 dark:text-slate-300">
                                <span className="sr-only">Source : </span>
                                {OFFER_SOURCES[offer.source]}
                              </span>
                            </div>
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
                      <Link href={href(page - 1)} className="ui-btn-secondary">
                        Précédent
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-muted dark:text-slate-400">
                      Page {page} sur {numberFormatter.format(pageCount)}
                    </span>
                    {page < pageCount ? (
                      <Link href={href(page + 1)} className="ui-btn-secondary">
                        Suivant
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                )}
              </section>
            )}

            {selected ? (
              // Collant sur grand écran : l'élément de la grille (et non la carte, aussi haute que
              // lui) reste visible pendant le défilement de la liste.
              <div className={result ? "lg:sticky lg:top-22" : "lg:col-span-2"}>
                <OfferDetails
                  key={selected.id}
                  offer={selected}
                  logo={logoOf(selected, 48)}
                  sourceLogo={SOURCE_LOGOS[selected.source] ?? null}
                  backHref={href(page)}
                  search={searchParamsOf(page).toString()}
                />
              </div>
            ) : (
              result &&
              result.offers.length > 0 && (
                <div className="hidden rounded-card border border-dashed border-line-strong dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center lg:sticky lg:top-22 lg:block">
                  <p className="font-medium text-ink dark:text-white">Sélectionne une offre</p>
                  <p className="mt-1 text-sm text-muted dark:text-slate-400">
                    Ses détails s&apos;afficheront ici : description, salaire, profil recherché.
                  </p>
                </div>
              )
            )}
          </div>
        )}

      </main>
    </div>
  );
}
