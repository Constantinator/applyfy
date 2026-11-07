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
      <dt className="text-xs font-medium tracking-wide text-muted dark:text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink dark:text-white">{children}</dd>
    </div>
  );
}

function ProfileList({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-ink dark:text-white">{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink dark:text-slate-200 marker:text-muted">
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
      className="ui-card flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
        <Link href={backHref} scroll={false} className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink lg:hidden dark:text-slate-400 dark:hover:text-white">
          Retour aux offres
        </Link>

        <header className="space-y-1.5">
          <h2 id="offre-titre" className="ui-title-sm font-bold">
            {offer.title}
          </h2>
          <p className="text-muted dark:text-slate-300">{offer.company ?? "Entreprise non communiquée"}</p>
          <p className="text-xs text-muted dark:text-slate-400">Source : {OFFER_SOURCES[offer.source]}</p>
        </header>

        <dl className="grid gap-4 rounded-block border border-line bg-surface p-[18px] sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50">
          <Fact label="Localisation">
            <span className="inline-flex items-center gap-1.5">
              <IconMapPin className="h-4 w-4 text-muted" />
              {offer.location ?? "Non précisée"}
            </span>
          </Fact>
          <Fact label="Contrat">
            <span className="inline-flex items-center gap-1.5">
              <IconBriefcase className="h-4 w-4 text-muted" />
              {[offer.contract, offer.workingHours].filter(Boolean).join(" · ") || "Non précisé"}
            </span>
          </Fact>
          <Fact label="Salaire">{offer.salary ?? "Non communiqué"}</Fact>
          <Fact label="Publication">
            <span className="inline-flex items-center gap-1.5">
              <IconClock className="h-4 w-4 text-muted" />
              {offer.publishedAt ? dateFormatter.format(new Date(offer.publishedAt)) : "Date inconnue"}
            </span>
          </Fact>
        </dl>

        <section aria-labelledby="offre-description" className="space-y-2">
          <h3 id="offre-description" className="font-semibold text-ink dark:text-white">
            Description du poste
          </h3>
          {offer.description ? (
            <>
              <FormattedText text={offer.description} />
              {offer.descriptionTruncated && (
                <p className="text-sm text-muted dark:text-slate-400">
                  Ceci n&apos;est qu&apos;un extrait : la description complète est sur l&apos;offre originale.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted dark:text-slate-400">Pas de description pour cette offre.</p>
          )}
        </section>

        {hasProfile ? (
          <section aria-labelledby="offre-profil" className="space-y-3">
            <h3 id="offre-profil" className="font-semibold text-ink dark:text-white">
              Profil recherché
            </h3>
            {profile.experience && <p className="text-sm text-ink dark:text-slate-200">Expérience : {profile.experience}</p>}
            <ProfileList title="Formation" items={profile.formations} />
            <ProfileList
              title="Compétences"
              items={profile.skills.map((skill) => (
                <>
                  {skill.label}
                  {skill.required && (
                    <span className="ml-1.5 rounded-full bg-box px-2 py-0.5 text-xs font-medium text-[#3F3F46] dark:bg-slate-800 dark:text-slate-300">
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
            <h3 id="offre-entreprise" className="font-semibold text-ink dark:text-white">
              L&apos;entreprise
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink dark:text-slate-200">{offer.companyDescription}</p>
          </section>
        )}
      </div>

      <OfferActions offerId={offer.id} search={search} title={offer.title} url={offer.url} />
    </article>
  );
}
