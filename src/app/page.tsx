import Link from "next/link";

const FEATURES = [
  {
    title: "Suivi en temps réel",
    description:
      "Toutes tes candidatures au même endroit, avec leur statut à jour : envoyée, relancée, entretien, offre.",
    icon: (
      <path d="M3 13h4l3-8 4 14 3-6h4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Ton CV optimisé",
    description:
      "Adapte ton CV et ta lettre à chaque offre, sans perdre ce qui fait ta personnalité.",
    icon: (
      <>
        <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
        <path d="M14 3v5h5M10 13h6M10 17h4" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "Rappels de relance",
    description:
      "Applyfy te prévient quand une entreprise tarde à répondre et prépare ton message de relance.",
    icon: (
      <>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" strokeLinejoin="round" />
        <path d="M10 21h4" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: "Tous tes documents",
    description:
      "CV, lettres, offres et échanges : chaque candidature garde son historique complet.",
    icon: (
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        strokeLinejoin="round"
      />
    ),
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

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        A
      </span>
      Applyfy
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
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
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 sm:px-4"
            >
              Créer mon compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-indigo-50 to-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <p className="mb-4 inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100">
              Pour tous ceux qui cherchent leur prochain job
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-balance text-slate-900 sm:text-6xl">
              Trouve ton job.{" "}
              <span className="text-indigo-600">Sans te noyer dans les candidatures.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-slate-600">
              Applyfy centralise tes candidatures, t&apos;aide à construire des CV et lettres qui te
              ressemblent, et te rappelle quand relancer.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Créer mon compte
              </Link>
              <a
                href="#comment-ca-marche"
                className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Voir comment ça marche
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              J&apos;ai déjà un compte →{" "}
              <Link href="/login" className="font-medium text-indigo-600 underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="features-title" className="text-center text-3xl font-bold text-slate-900">
            Tout ce qu&apos;il te faut pour décrocher ton job
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </svg>
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section
          id="comment-ca-marche"
          aria-labelledby="steps-title"
          className="scroll-mt-16 bg-slate-50"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="steps-title" className="text-center text-3xl font-bold text-slate-900">
              Comment ça marche
            </h2>
            <p className="mt-3 text-center text-slate-600">
              4 étapes, et ta recherche d&apos;emploi devient enfin organisée.
            </p>
            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Appel à l'action final */}
        <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-3xl bg-indigo-600 px-6 py-12 text-center sm:px-12">
            <h2 id="cta-title" className="text-3xl font-bold text-white">
              Prêt·e à reprendre le contrôle de ta recherche ?
            </h2>
            <p className="mt-3 text-indigo-100">
              Crée ton compte en une minute et ajoute ta première candidature.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-lg bg-amber-400 px-6 py-3 font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
            >
              Créer mon compte
            </Link>
            <p className="mt-5 text-sm text-indigo-100">
              J&apos;ai déjà un compte →{" "}
              <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Applyfy</p>
        </div>
      </footer>
    </div>
  );
}
