import Link from "next/link";

import { IconBriefcase, IconPlus, IconSparkles } from "@/components/icons";

/** Dashboard sans aucune candidature : invitation à ajouter la première. */
export function EmptyDashboard() {
  return (
    <section
      aria-labelledby="empty-title"
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm sm:py-20"
    >
      {/* Halo décoratif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 opacity-70 blur-3xl"
      />

      <div className="relative">
        {/* Illustration : mallette dans un médaillon dégradé, avec étincelles */}
        <div aria-hidden="true" className="relative mx-auto h-24 w-24">
          <div className="bg-brand-gradient flex h-24 w-24 items-center justify-center rounded-[1.75rem] text-white shadow-xl shadow-blue-500/25">
            <IconBriefcase className="h-11 w-11" />
          </div>
          <IconSparkles className="absolute -top-3 -right-4 h-7 w-7 text-cyan-500" />
          <span className="absolute -bottom-2 -left-3 h-4 w-4 rounded-full bg-blue-200" />
        </div>

        <h2 id="empty-title" className="mt-8 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Commence ta recherche d&apos;emploi
        </h2>
        <p className="mx-auto mt-3 max-w-md text-slate-500">
          Ajoute ta première candidature et laisse Applyfy t&apos;aider à décrocher le job idéal
        </p>

        <Link
          href="/candidatures/nouvelle"
          className="bg-brand-gradient mt-8 inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:shadow-xl hover:shadow-blue-500/40 hover:brightness-105 focus-visible:ring-4 focus-visible:ring-blue-500/30 focus-visible:outline-none"
        >
          <IconPlus className="h-5 w-5" />
          Ajouter ma première candidature
        </Link>
      </div>
    </section>
  );
}
