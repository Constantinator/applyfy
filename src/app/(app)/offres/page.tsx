import type { Metadata } from "next";
import Link from "next/link";

import { IconBriefcase, IconClock, IconMapPin, IconSearch } from "@/components/icons";
import { AddOfferButton } from "@/components/offers/add-offer-button";
import { requireUser } from "@/lib/auth";
import {
  CONTRACT_FILTERS,
  FranceTravailError,
  OFFERS_PAGE_SIZE,
  getSectors,
  isContractFilter,
  isFranceTravailConfigured,
  searchOffers,
  type OfferSearchResult,
  type ReferenceItem,
} from "@/lib/france-travail";
import { resolveDepartment, type Department } from "@/lib/geo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trouver une offre — Applyfy" };

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
const numberFormatter = new Intl.NumberFormat("fr-FR");

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

  const pageCount = result ? Math.ceil(Math.min(result.total, MAX_RESULTS) / OFFERS_PAGE_SIZE) : 0;
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (keywords) query.set("q", keywords);
    if (place) query.set("lieu", place);
    if (contract) query.set("contrat", contract);
    if (sector) query.set("secteur", sector);
    if (target > 1) query.set("page", String(target));
    return `/offres?${query}`;
  };

  const label = "text-sm font-medium text-slate-700";
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trouver une offre</h1>
        <p className="mt-1.5 text-slate-500">
          Les offres d&apos;emploi publiées sur France Travail, à ajouter en un clic à tes candidatures.
        </p>
      </div>

      {!configured ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          La recherche d&apos;offres n&apos;est pas encore configurée sur ce site (identifiants de
          l&apos;API France Travail manquants).
        </p>
      ) : (
        <form action="/offres" role="search" className="card space-y-4 p-5">
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

      {configured && !hasSearch && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-900">Lance ta recherche</p>
          <p className="mt-1 text-sm text-slate-500">
            Indique un poste, une ville ou un type de contrat pour voir les offres correspondantes.
          </p>
        </div>
      )}

      {result && (
        <section aria-labelledby="offres-resultats" className="space-y-4">
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
              {result.offers.map((offer) => (
                <li
                  key={offer.id}
                  className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="font-semibold text-slate-900">{offer.title}</h3>
                    <p className="text-sm text-slate-600">{offer.company ?? "Entreprise non communiquée"}</p>
                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
                      {offer.location && (
                        <li className="inline-flex items-center gap-1.5">
                          <IconMapPin className="h-4 w-4 text-slate-400" />
                          {offer.location}
                        </li>
                      )}
                      {offer.publishedAt && (
                        <li className="inline-flex items-center gap-1.5">
                          <IconClock className="h-4 w-4 text-slate-400" />
                          {publishedLabel(offer.publishedAt)}
                        </li>
                      )}
                      {offer.contract && (
                        <li className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                          <IconBriefcase className="h-3.5 w-3.5" />
                          {offer.contract}
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <AddOfferButton offerId={offer.id} title={offer.title} />
                    <a
                      href={`https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(offer.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Voir sur France Travail ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <nav aria-label="Pages de résultats" className="flex items-center justify-between pt-2 text-sm">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-secondary px-4 py-2">
                  ← Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-slate-500">
                Page {page} sur {numberFormatter.format(pageCount)}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(page + 1)} className="btn-secondary px-4 py-2">
                  Suivant →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}

      <p className="text-xs text-slate-400">Offres fournies par l&apos;API Offres d&apos;emploi de France Travail.</p>
    </main>
  );
}
