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
import { LogoFull } from "@/components/logo";

// « Les chiffres qui font mal » : chiffre mis en avant, puis sa description.
const PAIN_STATS = [
  { value: "40", label: "candidatures en moyenne avant de décrocher un job" },
  { value: "75 %", label: "des CV rejetés automatiquement par les algorithmes" },
  { value: "14 jours", label: "d'attente moyenne sans réponse après une candidature" },
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

const STEPS = [
  {
    title: "Crée ton profil",
    description: "Ta formation, tes compétences, tes expériences : une seule fois, pour toutes tes candidatures.",
  },
  {
    title: "Ajoute une offre",
    description: "Colle l'annonce qui t'intéresse. Applyfy en extrait l'essentiel pour toi.",
  },
  {
    title: "Rédige avec l'assistant",
    description: "Génère un CV et une lettre adaptés à l'offre, puis ajuste-les à ta façon.",
  },
  {
    title: "Relance au bon moment",
    description: "Suis les réponses depuis ton dashboard et relance en un clic quand il le faut.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Applyfy, accueil">
            <LogoFull className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium sm:gap-6">
            <a href="#comment-ca-marche" className="hidden text-slate-600 hover:text-slate-900 sm:block">
              Comment ça marche
            </a>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Se connecter
            </Link>
            <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
              Créer mon compte
            </Link>
          </nav>
        </div>
      </header>

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
              {/* Cyan du logo (#06B6D4) : seule exception à la règle « cyan réservé au logo ». */}
              <span className="text-[#06B6D4]">Sans te noyer dans les candidatures.</span>
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
              <Link href="/login" className="font-medium text-blue-600 underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Programme beta : Premium offert jusqu&apos;au 31 décembre 2026 (30 places) →{" "}
              <BetaJoinDialog
                mode="link"
                triggerClassName="font-medium text-blue-600 underline-offset-4 hover:underline"
              />
            </p>
          </div>
        </section>

        {/* Les chiffres qui font mal */}
        <section aria-labelledby="stats-title" className="border-t border-slate-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
              La réalité du marché
            </p>
            <h2 id="stats-title" className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Les chiffres qui font mal
            </h2>
            <ul className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-200">
              {PAIN_STATS.map((stat) => (
                <li key={stat.value} className="flex flex-col items-center px-6 text-center">
                  <p className="text-brand text-6xl font-extrabold tracking-tight whitespace-nowrap sm:text-5xl lg:text-7xl">
                    {stat.value}
                  </p>
                  <p className="mt-3 max-w-[16rem] text-base leading-relaxed text-slate-600">{stat.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Fonctionnalités */}
        <section aria-labelledby="features-title" className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
              Fonctionnalités
            </p>
            <h2 id="features-title" className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tout ce qu&apos;il te faut pour décrocher ton job
            </h2>
            {/* 2 colonnes au plus : les aperçus de l'interface restent lisibles. */}
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="card p-5 transition-transform duration-200 hover:-translate-y-0.5 sm:p-6"
                >
                  <feature.preview />
                  <div className="mt-5 flex items-center gap-3">
                    <span className="bg-brand-cyan/10 text-brand-cyan ring-brand-cyan/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1">
                      <feature.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" aria-labelledby="steps-title" className="scroll-mt-16 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <p className="text-center text-sm font-semibold tracking-wide text-blue-600 uppercase">
              Comment ça marche
            </p>
            <h2 id="steps-title" className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
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
                  <span className="bg-brand relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md shadow-blue-600/25 ring-4 ring-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Appel à l'action final */}
        <section aria-labelledby="cta-title" className="px-4 pb-24 sm:px-6">
          <div className="bg-brand relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-14 text-center shadow-xl shadow-blue-600/20 sm:px-12">
            <h2 id="cta-title" className="relative text-3xl font-bold tracking-tight text-white">
              Prêt(e) à reprendre le contrôle de ta recherche ?
            </h2>
            <p className="relative mt-3 text-blue-50">
              Crée ton compte en une minute et ajoute ta première candidature.
            </p>
            <Link
              href="/signup"
              className="relative mt-8 inline-flex rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              Créer mon compte
            </Link>
            <p className="relative mt-5 text-sm text-blue-50">
              J&apos;ai déjà un compte →{" "}
              <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </section>
      </main>
      {/* Pied de page : commun à toutes les pages (layout racine). */}
    </div>
  );
}
