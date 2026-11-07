import Link from "next/link";

import { IconBriefcase, IconPlus, IconSparkles } from "@/components/icons";

/** Dashboard sans aucune candidature : invitation à ajouter la première. */
export function EmptyDashboard() {
  return (
    <section
      aria-labelledby="empty-title"
      className="ui-card px-6 py-14 text-center sm:py-20"
    >
      <div>
        {/* Illustration : mallette dans un médaillon noir, avec étincelles */}
        <div aria-hidden="true" className="relative mx-auto h-24 w-24">
          <div className="flex h-24 w-24 items-center justify-center rounded-card bg-ink text-white dark:bg-white dark:text-slate-900">
            <IconBriefcase className="h-11 w-11" />
          </div>
          <IconSparkles className="absolute -top-3 -right-4 h-7 w-7 text-accent dark:text-blue-400" />
          <span className="absolute -bottom-2 -left-3 h-4 w-4 rounded-full bg-accent dark:bg-blue-400" />
        </div>

        <h2 id="empty-title" className="mt-8 text-2xl font-semibold tracking-title text-ink dark:text-white sm:text-3xl">
          Commence ta recherche d&apos;emploi
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted dark:text-slate-400">
          Ajoute ta première candidature et laisse Applyfy t&apos;aider à décrocher le job idéal
        </p>

        <Link
          href="/candidatures/nouvelle"
          className="ui-btn-primary mt-8 px-7 py-3"
        >
          <IconPlus className="h-5 w-5" />
          Ajouter ma première candidature
        </Link>
      </div>
    </section>
  );
}
