import Link from "next/link";

import { FormattedText } from "@/components/formatted-text";
import { IconBriefcase, IconClock, IconMapPin } from "@/components/icons";
import { OFFER_SOURCES, type OfferListing } from "@/lib/offer-types";

import { OfferActions } from "./offer-actions";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 dark:text-white">{children}</dd>
    </div>
  );
}

function ProfileList({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-slate-900 dark:text-white">{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200 marker:text-slate-400">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Panneau de détails d'une offre : à droite de la liste sur grand écran (défilement
 * propre, boutons toujours visibles en bas), pleine largeur sur mobile.
 */
export function OfferDetails({
  offer,
  backHref,
  search,
}: {
  offer: OfferListing;
  backHref: string;
  /** Paramètres d'URL de la recherche en cours. */
  search: string;
}) {
  const { profile } = offer;
  const hasProfile =
    profile.experience ||
    profile.formations.length ||
    profile.skills.length ||
    profile.qualities.length ||
    profile.languages.length ||
    profile.licences.length;

  return (
    <article
      aria-labelledby="offre-titre"
      className="card flex flex-col overflow-hidden lg:max-h-[calc(100vh-3rem)]"
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
        <Link href={backHref} scroll={false} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white lg:hidden">
          ← Retour aux offres
        </Link>

        <header className="space-y-1.5">
          <h2 id="offre-titre" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {offer.title}
          </h2>
          <p className="text-slate-600 dark:text-slate-300">{offer.company ?? "Entreprise non communiquée"}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Source : {OFFER_SOURCES[offer.source]}</p>
        </header>

        <dl className="grid gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 ring-1 ring-slate-200 dark:ring-slate-700 sm:grid-cols-2">
          <Fact label="Localisation">
            <span className="inline-flex items-center gap-1.5">
              <IconMapPin className="h-4 w-4 text-slate-400" />
              {offer.location ?? "Non précisée"}
            </span>
          </Fact>
          <Fact label="Contrat">
            <span className="inline-flex items-center gap-1.5">
              <IconBriefcase className="h-4 w-4 text-slate-400" />
              {[offer.contract, offer.workingHours].filter(Boolean).join(" · ") || "Non précisé"}
            </span>
          </Fact>
          <Fact label="Salaire">{offer.salary ?? "Non communiqué"}</Fact>
          <Fact label="Publication">
            <span className="inline-flex items-center gap-1.5">
              <IconClock className="h-4 w-4 text-slate-400" />
              {offer.publishedAt ? dateFormatter.format(new Date(offer.publishedAt)) : "Date inconnue"}
            </span>
          </Fact>
        </dl>

        <section aria-labelledby="offre-description" className="space-y-2">
          <h3 id="offre-description" className="font-semibold text-slate-900 dark:text-white">
            Description du poste
          </h3>
          {offer.description ? (
            <>
              <FormattedText text={offer.description} />
              {offer.descriptionTruncated && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ceci n&apos;est qu&apos;un extrait : la description complète est sur l&apos;offre originale.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Pas de description pour cette offre.</p>
          )}
        </section>

        {hasProfile ? (
          <section aria-labelledby="offre-profil" className="space-y-3">
            <h3 id="offre-profil" className="font-semibold text-slate-900 dark:text-white">
              Profil recherché
            </h3>
            {profile.experience && <p className="text-sm text-slate-700 dark:text-slate-200">Expérience : {profile.experience}</p>}
            <ProfileList title="Formation" items={profile.formations} />
            <ProfileList
              title="Compétences"
              items={profile.skills.map((skill) => (
                <>
                  {skill.label}
                  {skill.required && (
                    <span className="ml-1.5 rounded-full bg-blue-50 dark:bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                      exigée
                    </span>
                  )}
                </>
              ))}
            />
            <ProfileList title="Savoir-être" items={profile.qualities} />
            <ProfileList title="Langues" items={profile.languages} />
            <ProfileList title="Permis" items={profile.licences} />
          </section>
        ) : null}

        {offer.companyDescription && (
          <section aria-labelledby="offre-entreprise" className="space-y-2">
            <h3 id="offre-entreprise" className="font-semibold text-slate-900 dark:text-white">
              L&apos;entreprise
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-200">{offer.companyDescription}</p>
          </section>
        )}
      </div>

      <OfferActions offerId={offer.id} search={search} title={offer.title} url={offer.url} />
    </article>
  );
}
