import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { IconBriefcase, IconClock, IconMapPin, IconSearch } from "@/components/icons";
import { OfferDetails } from "@/components/offers/offer-details";
import { OfferLink } from "@/components/offers/offer-link";
import { requireUser } from "@/lib/auth";
import {
  CONTRACT_FILTERS,
  FranceTravailError,
  OFFERS_PAGE_SIZE,
  getOfferListing,
  getSectors,
  isContractFilter,
  isFranceTravailConfigured,
  isOfferId,
  searchOffers,
  type OfferListing,
  type OfferSearchResult,
  type ReferenceItem,
} from "@/lib/france-travail";
import { resolveDepartment, type Department } from "@/lib/geo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trouver une offre — Applyfy" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
const numberFormatter = new Intl.NumberFormat("fr-FR");

/** Logo France Travail (public/france-travail.svg), proportions 127 × 45. */
const FRANCE_TRAVAIL_LOGO = { src: "/france-travail.svg", width: 127, height: 45 };

/** L'API ne renvoie pas d'offres au-delà de 1 150 résultats. */
const MAX_RESULTS = 1150;

const text = (value: string | string[] | undefined, max = 120) =>
  (typeof value === "string" ? value : "").trim().slice(0, max);

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
  const keywords = text(params.q);
  const place = text(params.lieu, 80);
  const contract = isContractFilter(params.contrat) ? params.contrat : null;
  const sector = /^[A-Za-z0-9]{1,6}$/.test(text(params.secteur)) ? text(params.secteur) : null;
  const page = Math.max(1, Math.min(Number.parseInt(text(params.page), 10) || 1, MAX_RESULTS / OFFERS_PAGE_SIZE));
  const hasSearch = Boolean(keywords || place || contract || sector);
  /** Offre affichée dans le panneau de détails (?offre=). */
  const selectedId = isOfferId(params.offre) ? params.offre : null;
  const configured = isFranceTravailConfigured();

  let sectors: ReferenceItem[] = [];
  let department: Department | null = null;
  let result: OfferSearchResult | null = null;
  let error: string | null = null;

  if (configured) {
    // Filtres : sans secteurs (service indisponible), la recherche reste possible.
    sectors = await getSectors().catch((e) => {
      console.error("[offres] secteurs", e);
      return [];
    });
    if (hasSearch) {
      department = place ? await resolveDepartment(place) : null;
      if (place && !department) {
        error = `Localisation « ${place} » introuvable : indique une ville ou un numéro de département (ex. Lyon, 69).`;
      } else {
        try {
          result = await searchOffers({ keywords, department: department?.code ?? null, contract, sector, page });
        } catch (e) {
          if (!(e instanceof FranceTravailError)) console.error("[offres] recherche", e);
          error = e instanceof FranceTravailError ? e.message : "La recherche a échoué. Réessaie dans un instant.";
        }
      }
    }
  }

  // Offre sélectionnée : déjà dans les résultats, sinon lue à part (lien partagé, page changée).
  let selected: OfferListing | null = null;
  let selectedMissing = false;
  if (configured && selectedId) {
    selected = result?.offers.find((offer) => offer.id === selectedId) ?? null;
    if (!selected) {
      selected = await getOfferListing(selectedId).catch((e) => {
        if (!(e instanceof FranceTravailError)) console.error("[offres] détail", e);
        return null;
      });
      selectedMissing = !selected;
    }
  }

  const pageCount = result ? Math.ceil(Math.min(result.total, MAX_RESULTS) / OFFERS_PAGE_SIZE) : 0;
  const href = (target: number, offre: string | null = null) => {
    const query = new URLSearchParams();
    if (keywords) query.set("q", keywords);
    if (place) query.set("lieu", place);
    if (contract) query.set("contrat", contract);
    if (sector) query.set("secteur", sector);
    if (target > 1) query.set("page", String(target));
    if (offre) query.set("offre", offre);
    return `/offres?${query}`;
  };
  // Sur mobile, l'offre sélectionnée s'affiche seule (page dédiée) : le reste est masqué.
  const mobileHidden = selected ? "max-lg:hidden" : "";

  const label = "text-sm font-medium text-slate-700";
  return (
    <main
      className={`mx-auto w-full ${result || selected ? "max-w-7xl" : "max-w-5xl"} flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trouver une offre</h1>
        <p className="mt-1.5 text-slate-500">
          Trouve ton prochain job et ajoute-le en un clic à tes candidatures.
        </p>
      </div>

      {!configured ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          La recherche d&apos;offres n&apos;est pas encore configurée sur ce site (identifiants de
          l&apos;API France Travail manquants).
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
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {selectedMissing && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Cette offre n&apos;est plus disponible sur France Travail.
        </p>
      )}

      {configured && !hasSearch && !selected && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-900">Lance ta recherche</p>
          <p className="mt-1 text-sm text-slate-500">
            Indique un poste, une ville ou un type de contrat pour voir les offres correspondantes.
          </p>
        </div>
      )}

      {(result || selected) && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {result && (
            <section aria-labelledby="offres-resultats" className={`space-y-4 ${mobileHidden}`}>
              <h2 id="offres-resultats" className="text-sm text-slate-600">
                <strong className="font-semibold text-slate-900">
                  {numberFormatter.format(result.total)} offre{result.total > 1 ? "s" : ""}
                </strong>
                {department && <> · {department.name}</>}
                {result.total > MAX_RESULTS && " · affine ta recherche pour voir les plus pertinentes"}
              </h2>

              {result.offers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <p className="font-medium text-slate-900">Aucune offre ne correspond</p>
                  <p className="mt-1 text-sm text-slate-500">Essaie d&apos;autres mots-clés ou retire un filtre.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {result.offers.map((offer) => {
                    const isSelected = offer.id === selected?.id;
                    return (
                      <li key={offer.id}>
                        <OfferLink
                          href={href(page, offer.id)}
                          selected={isSelected}
                          className={`card relative block space-y-1.5 p-4 pb-9 transition ${
                            isSelected ? "bg-blue-50/60 ring-2 ring-blue-500" : "hover:ring-1 hover:ring-blue-300"
                          }`}
                        >
                          <h3 className="font-semibold text-slate-900">{offer.title}</h3>
                          <p className="text-sm text-slate-600">{offer.company ?? "Entreprise non communiquée"}</p>
                          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            {offer.location && (
                              <li className="inline-flex items-center gap-1">
                                <IconMapPin className="h-3.5 w-3.5 text-slate-400" />
                                {offer.location}
                              </li>
                            )}
                            {offer.publishedAt && (
                              <li className="inline-flex items-center gap-1">
                                <IconClock className="h-3.5 w-3.5 text-slate-400" />
                                {publishedLabel(offer.publishedAt)}
                              </li>
                            )}
                            {offer.contract && (
                              <li className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 ring-1 ring-blue-100">
                                <IconBriefcase className="h-3 w-3" />
                                {offer.contract}
                              </li>
                            )}
                          </ul>
                          {/* Source de l'offre (aussi indiquée en pied de page) : décoratif. */}
                          <Image
                            {...FRANCE_TRAVAIL_LOGO}
                            alt=""
                            className="pointer-events-none absolute right-4 bottom-2.5 h-5 w-auto opacity-80"
                          />
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
                  <span className="text-slate-500">
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
              <OfferDetails key={selected.id} offer={selected} backHref={href(page)} />
            </div>
          ) : (
            result &&
            result.offers.length > 0 && (
              <div className="hidden rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center lg:sticky lg:top-6 lg:block">
                <p className="font-medium text-slate-900">Sélectionne une offre</p>
                <p className="mt-1 text-sm text-slate-500">
                  Ses détails s&apos;afficheront ici : description, salaire, profil recherché.
                </p>
              </div>
            )
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">Offres fournies par l&apos;API Offres d&apos;emploi de France Travail.</p>
    </main>
  );
}
