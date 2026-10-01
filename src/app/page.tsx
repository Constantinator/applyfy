import Link from "next/link";
import { Suspense } from "react";

import { AccountDeletedNotice } from "@/components/account-deleted-notice";
import { IconActivity, IconBell, IconDocument, IconFolder } from "@/components/icons";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    title: "Suivi en temps réel",
    description:
      "Toutes tes candidatures au même endroit, avec leur statut à jour : envoyée, relancée, entretien, offre.",
    icon: IconActivity,
  },
  {
    title: "Ton CV optimisé",
    description:
      "Adapte ton CV et ta lettre à chaque offre, sans perdre ce qui fait ta personnalité.",
    icon: IconDocument,
  },
  {
    title: "Rappels de relance",
    description:
      "Applyfy te prévient quand une entreprise tarde à répondre et prépare ton message de relance.",
    icon: IconBell,
  },
  {
    title: "Tous tes documents",
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

/** Aperçu décoratif du dashboard dans le hero. */
function DashboardPreview() {
  const rows = [
    { company: "Doctolib", role: "Product Manager", status: "Entretien", tone: "bg-violet-50 text-violet-700" },
    { company: "Qonto", role: "Business Developer", status: "Envoyée", tone: "bg-blue-50 text-blue-700" },
    { company: "Alan", role: "Growth Marketing", status: "À relancer", tone: "bg-amber-50 text-amber-700" },
  ];
  return (
    <div aria-hidden="true" className="card mx-auto mt-16 max-w-3xl overflow-hidden text-left">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        {[
          ["Candidatures", "12"],
          ["Entretiens", "3"],
          ["À relancer", "2"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {rows.map((row) => (
          <li key={row.company} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>
              <span className="font-semibold text-slate-900">{row.company}</span>
              <span className="text-slate-500"> · {row.role}</span>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.tone}`}>{row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Applyfy, accueil">
            <Logo />
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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 h-[34rem] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),rgba(6,182,212,0.08)_40%,transparent_70%)]"
          />
          <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 py-1 pr-3 pl-1 text-sm text-slate-600 shadow-sm">
              <span className="bg-brand-gradient rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                Nouveau
              </span>
              Pour tous ceux qui cherchent leur prochain job
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-6xl sm:leading-[1.05]">
              Trouve ton job.{" "}
              <span className="text-brand-gradient">Sans te noyer dans les candidatures.</span>
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

            <DashboardPreview />
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
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="card p-6 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <span className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm shadow-blue-600/20">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-semibold text-slate-900">{feature.title}</h3>
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
                className="absolute top-5 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200 lg:block"
              />
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative text-center">
                  <span className="bg-brand-gradient relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md shadow-blue-600/25 ring-4 ring-white">
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
          <div className="bg-brand-gradient relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-14 text-center shadow-xl shadow-blue-600/20 sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]"
            />
            <h2 id="cta-title" className="relative text-3xl font-bold tracking-tight text-white">
              Prêt·e à reprendre le contrôle de ta recherche ?
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

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo size="sm" />
          <nav className="flex gap-6">
            <a href="#comment-ca-marche" className="hover:text-slate-900">
              Comment ça marche
            </a>
            <Link href="/login" className="hover:text-slate-900">
              Se connecter
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Applyfy</p>
        </div>
      </footer>
    </div>
  );
}
