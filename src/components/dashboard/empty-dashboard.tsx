import Link from "next/link";

import { IconBriefcase, IconPlus } from "@/components/icons";

/** Dashboard sans aucune candidature : invitation à ajouter la première. */
export function EmptyDashboard() {
  return (
    <section aria-labelledby="empty-title" className="ui-card px-6 py-14 text-center sm:py-20">
      {/* Illustration : mallette dans un carré gris */}
      <div
        aria-hidden="true"
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-card bg-box text-ink dark:bg-slate-800 dark:text-slate-200"
      >
        <IconBriefcase className="h-11 w-11" />
      </div>

      <h2 id="empty-title" className="ui-title mt-8">
        Commence ta recherche d&apos;emploi
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted dark:text-slate-400">
        Ajoute ta première candidature et laisse Applyfy t&apos;aider à décrocher le job idéal
      </p>

      <Link href="/candidatures/nouvelle" className="ui-btn-primary mt-8">
        <IconPlus className="h-5 w-5" />
        Ajouter ma première candidature
      </Link>
    </section>
  );
}
