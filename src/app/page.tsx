import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountDeletedNotice } from "@/components/account-deleted-notice";
import { BetaJoinDialog } from "@/components/beta/beta-join-dialog";
import { IconActivity, IconBell, IconDocument, IconFolder } from "@/components/icons";
import {
  CvPreview,
  DocumentsPreview,
  FollowUpPreview,
  TrackingPreview,
} from "@/components/landing/feature-previews";
import { CountUp } from "@/components/landing/count-up";
import { ImageLightbox } from "@/components/landing/image-lightbox";
import { Reveal } from "@/components/landing/reveal";
import { LogoFull } from "@/components/logo";
import { SiteHeader } from "@/components/site/site-header";
import { PREMIUM_PRICE_LABEL } from "@/lib/ai-usage-limits";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Applyfy — Gère tes candidatures et décroche ton job",
  description:
    "Applyfy centralise tes candidatures, adapte ton CV et ta lettre pour chaque offre, et te rappelle quand relancer. Gratuit.",
  path: "/",
});

// « Les chiffres qui font mal » : chiffre mis en avant, puis sa description.
const PAIN_STATS = [
  { value: "40", label: "candidatures en moyenne avant de décrocher un job" },
  {
    value: "75 %",
    label: "des CV rejetés automatiquement par les algorithmes",
  },
  {
    value: "14 jours",
    label: "d'attente moyenne sans réponse après une candidature",
  },
];

const FEATURES = [
  {
    title: "Suivi en temps réel",
    preview: TrackingPreview,
    description:
      "Toutes tes candidatures au même endroit, avec leur statut à jour : envoyée, relancée, entretien, offre.",
    icon: IconActivity,
  },
  {
    title: "Ton CV optimisé",
    preview: CvPreview,
    description:
      "Adapte ton CV et ta lettre à chaque offre, sans perdre ce qui fait ta personnalité.",
    icon: IconDocument,
  },
  {
    title: "Rappels de relance",
    preview: FollowUpPreview,
    description:
      "Applyfy te prévient quand une entreprise tarde à répondre et prépare ton message de relance.",
    icon: IconBell,
  },
  {
    title: "Tous tes documents",
    preview: DocumentsPreview,
    description:
      "CV, lettres, offres et échanges : chaque candidature garde son historique complet.",
    icon: IconFolder,
  },
];

/**
 * Témoignages de bêta-testeurs (« Ce qu'ils en disent »). Uniquement de vrais avis, publiés
 * avec l'accord de leur auteur : tant que la liste est vide, la section n'est pas affichée.
 */
const TESTIMONIALS: { quote: string; name: string; context: string }[] = [];

/**
 * « Pourquoi Applyfy ? » : yes = oui, no = non, partial = partiel ou plan payant uniquement.
 * Comparatif nominatif : chaque case doit rester exacte et vérifiable (Huntr : huntr.co/pricing,
 * vérifié le 12 octobre 2026). À revoir si Huntr ou Applyfy changent leurs offres.
 */
type Support = "yes" | "no" | "partial";

const COMPARISON_TOOLS = [
  { name: "Applyfy", price: `Gratuit · ${PREMIUM_PRICE_LABEL}` },
  { name: "Huntr", price: "Pro : 40 $/mois" },
  { name: "Excel / Word", price: null },
] as const;

const COMPARISON: { feature: string; values: [Support, Support, Support] }[] = [
  { feature: "Interface en français", values: ["yes", "no", "yes"] },
  { feature: "Suivi des candidatures", values: ["yes", "yes", "no"] },
  { feature: "Recherche d'offres intégrée", values: ["yes", "no", "no"] },
  { feature: "CV adapté à l'offre (IA)", values: ["yes", "partial", "no"] },
  { feature: "Lettre de motivation IA", values: ["yes", "partial", "no"] },
  { feature: "Rappels de relance", values: ["yes", "partial", "no"] },
];

// `size` : taille et graisse du symbole (hors colonne Applyfy, mise en avant à part).
const SUPPORT_DISPLAY: Record<
  Support,
  { symbol: string; label: string; className: string; size: string }
> = {
  yes: { symbol: "✓", label: "Oui", className: "text-emerald-600", size: "text-lg font-bold" },
  no: { symbol: "✕", label: "Non", className: "text-red-500", size: "text-xl font-black" },
  partial: {
    symbol: "~",
    label: "Partiel",
    className: "text-amber-500",
    size: "text-xl font-semibold",
  },
};

const STEPS = [
  {
    title: "Ajoute une offre",
    description:
      "Colle le lien d'une offre ou trouve-en une directement depuis Applyfy. Ta fiche candidature est créée en quelques secondes.",
  },
  {
    title: "Prépare ta candidature",
    description:
      "Adapte ton CV et génère une lettre de motivation personnalisée pour chaque offre.",
  },
  {
    title: "Suis l'évolution",
    description:
      "Suis le statut de chaque candidature depuis ton dashboard et relance au bon moment.",
  },
  {
    title: "Retrouve tes documents",
    description:
      "Tous tes CV et lettres de motivation sont sauvegardés par candidature, prêts pour tes entretiens.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* Suspense : la page d'accueil reste statique, le message est lu côté navigateur. */}
        <Suspense fallback={null}>
          <AccountDeletedNotice />
        </Suspense>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
            {/* Logo complet, centré au-dessus du titre (320 px de large). */}
            <LogoFull className="mx-auto mb-10 block h-auto w-80" />
            <h1 className="text-4xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-6xl sm:leading-[1.05]">
              Trouve ton job.{" "}
              <span className="text-blue-600">Sans te noyer dans les candidatures.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-slate-500">
              Applyfy centralise tes candidatures, t&apos;aide à construire des CV et lettres qui te
              ressemblent, et te rappelle quand relancer.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Créer mon compte
              </Link>
              <a href="#comment-ca-marche" className="btn-secondary px-6 py-3 text-base">
                Voir comment ça marche
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              J&apos;ai déjà un compte →{" "}
              <Link
                href="/login"
                className="font-medium text-blue-600 underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </p>
            {/* Bloc et non paragraphe : le lien ouvre une fenêtre (<dialog>), interdite dans un <p>. */}
            <div className="mt-2 text-sm text-slate-500">
              Programme beta : Premium offert jusqu&apos;au 31 décembre 2026 (30 places) →{" "}
              <BetaJoinDialog
                mode="link"
                triggerClassName="font-medium text-blue-600 underline-offset-4 hover:underline"
              />
            </div>

            {/*
              Capture du dashboard, mise en avant façon linear.app : elle sort du conteneur du
              hero pour occuper ~84 % de la largeur de l'écran (pleine largeur moins les marges
              sur mobile, 1 600 px au plus pour ne pas agrandir l'image), ombre portée marquée.
              Agrandie au clic.
            */}
            <figure className="relative left-1/2 mt-20 w-[calc(100vw-2rem)] max-w-[1600px] -translate-x-1/2 sm:mt-24 sm:w-[84vw]">
              <ImageLightbox
                src="/images/dashboard-preview.png"
                alt="Le dashboard Applyfy : compteurs de candidatures, filtres par statut et liste des candidatures avec leur date d'envoi et un bouton Relancer"
                width={1920}
                height={1317}
                sizes="(min-width: 1905px) 1600px, (min-width: 640px) 84vw, calc(100vw - 32px)"
                className="h-auto w-full rounded-2xl border border-slate-200/80 shadow-[0_50px_100px_-20px_rgba(15,23,42,0.35),0_30px_60px_-30px_rgba(15,23,42,0.4)]"
              />
              <figcaption className="mt-4 text-sm text-slate-500">
                Le dashboard Applyfy — toutes tes candidatures au même endroit
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Les chiffres qui font mal */}
        <section aria-labelledby="stats-title" className="border-t border-slate-100 bg-white">
          <Reveal className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
              La réalité du marché
            </p>
            <h2
              id="stats-title"
              className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            >
              Les chiffres qui font mal
            </h2>
            <ul className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-200">
              {PAIN_STATS.map((stat) => (
                <li key={stat.value} className="flex flex-col items-center px-6 text-center">
                  <CountUp
                    value={stat.value}
                    className="text-brand text-6xl font-extrabold tracking-tight whitespace-nowrap sm:text-5xl lg:text-7xl"
                  />
                  <p className="mt-3 max-w-[16rem] text-base leading-relaxed text-slate-600">
                    {stat.label}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* Fonctionnalités */}
        <section aria-labelledby="features-title" className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal>
              <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
                Fonctionnalités
              </p>
              <h2
                id="features-title"
                className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
              >
                Tout ce qu&apos;il te faut pour décrocher ton job
              </h2>
            </Reveal>
            {/* 2 colonnes au plus : les aperçus de l'interface restent lisibles. */}
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
              {FEATURES.map((feature, index) => (
                // Les cartes apparaissent l'une après l'autre (150 ms d'écart).
                <Reveal key={feature.title} delay={index * 150} className="flex">
                  <article className="card w-full p-5 transition-transform duration-200 hover:-translate-y-0.5 sm:p-6">
                    <feature.preview />
                    <div className="mt-5 flex items-center gap-3">
                      <span className="bg-blue-600/10 text-blue-600 ring-blue-600/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1">
                        <feature.icon className="h-5 w-5" />
                      </span>
                      <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {feature.description}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Ce qu'ils en disent : masqué tant qu'aucun témoignage réel n'a été ajouté. */}
        {TESTIMONIALS.length > 0 && (
          <section
            aria-labelledby="testimonials-title"
            className="border-t border-slate-100 bg-white"
          >
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
              <Reveal>
                <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
                  Témoignages
                </p>
                <h2
                  id="testimonials-title"
                  className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                >
                  Ce qu&apos;ils en disent
                </h2>
              </Reveal>
              <ul className="mt-14 grid gap-6 md:grid-cols-3">
                {TESTIMONIALS.map((testimonial, index) => (
                  <li key={testimonial.name} className="flex">
                    <Reveal delay={index * 150} className="flex w-full">
                      <figure className="card flex w-full flex-col p-6">
                        <blockquote className="flex-1 text-sm leading-relaxed text-slate-600">
                          « {testimonial.quote} »
                        </blockquote>
                        <figcaption className="mt-5 text-sm">
                          <span className="font-semibold text-slate-900">{testimonial.name}</span>
                          <span className="block text-slate-500">{testimonial.context}</span>
                        </figcaption>
                      </figure>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Comment ça marche */}
        <section
          id="comment-ca-marche"
          aria-labelledby="steps-title"
          className="scroll-mt-16 bg-white"
        >
          <Reveal className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
              Comment ça marche
            </p>
            <h2
              id="steps-title"
              className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            >
              4 étapes, et ta recherche devient organisée
            </h2>
            <ol className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ligne de liaison entre les étapes (grand écran) */}
              <span
                aria-hidden="true"
                className="absolute top-5 right-[12%] left-[12%] hidden h-px bg-blue-200 lg:block"
              />
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative text-center">
                  <span className="bg-blue-600 shadow-blue-600/25 relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-4 ring-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* Pourquoi Applyfy ? */}
        <section aria-labelledby="why-title" className="border-t border-slate-100 bg-slate-50">
          <Reveal className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
            <h2
              id="why-title"
              className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
            >
              Pourquoi Applyfy ?
            </h2>
            <p className="mt-3 text-center text-lg text-slate-500">
              Ce que les autres outils ne font pas (ou font payer très cher).
            </p>
            {/* Défilement horizontal sur très petit écran plutôt qu'un tableau écrasé. */}
            <div className="card mt-12 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <caption className="sr-only">
                  Comparatif d&apos;Applyfy avec Huntr et Excel / Word
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-4 text-left font-semibold text-slate-500">
                      <span className="sr-only">Fonctionnalité</span>
                    </th>
                    {COMPARISON_TOOLS.map((tool, index) => (
                      <th
                        key={tool.name}
                        scope="col"
                        className={`px-4 py-4 text-center font-semibold ${
                          index === 0 ? "rounded-t-xl bg-[#1E40AF] text-white" : "text-slate-700"
                        }`}
                      >
                        {tool.name}
                        {tool.price && (
                          <span
                            className={`mt-0.5 block text-xs font-normal ${
                              index === 0 ? "text-white/75" : "text-slate-500"
                            }`}
                          >
                            {tool.price}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-t border-slate-100">
                      <th scope="row" className="px-4 py-3.5 text-left font-medium text-slate-700">
                        {row.feature}
                      </th>
                      {row.values.map((value, index) => {
                        const display = SUPPORT_DISPLAY[value];
                        return (
                          <td
                            key={COMPARISON_TOOLS[index].name}
                            // Colonne Applyfy mise en avant : fond vert léger, symbole plus grand.
                            className={`px-4 py-3.5 text-center ${display.className} ${
                              index === 0 ? "bg-green-50 text-2xl font-black" : display.size
                            }`}
                          >
                            <span aria-hidden="true">{display.symbol}</span>
                            <span className="sr-only">{display.label}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">
              ~ = fonctionnalité partielle ou disponible uniquement sur plan payant
            </p>
          </Reveal>
        </section>

        {/* Appel à l'action final */}
        <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6 sm:py-28">
          {/* Sans cadre : fond blanc de la page, titre bleu et bouton principal habituel. */}
          <Reveal className="mx-auto max-w-4xl text-center">
            <h2 id="cta-title" className="text-3xl font-bold tracking-tight text-[#1E40AF]">
              Prêt(e) à reprendre le contrôle de ta recherche ?
            </h2>
            <p className="mt-3 text-slate-600">
              Crée ton compte en une minute et ajoute ta première candidature.
            </p>
            <Link href="/signup" className="btn-primary mt-8 px-6 py-3 text-base">
              Créer mon compte
            </Link>
            <p className="mt-5 text-sm text-slate-500">
              J&apos;ai déjà un compte →{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </Reveal>
        </section>
      </main>
      {/* Pied de page : commun à toutes les pages (layout racine). */}
    </div>
  );
}
