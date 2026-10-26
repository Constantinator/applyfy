import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DeleteBuilderCvButton } from "@/components/cv-builder/delete-cv-button";
import { NewCvDialog } from "@/components/cv-builder/new-cv-dialog";
import { IconDocument } from "@/components/icons";
import { CV_BUILDER_MAX, listBuilderCvs } from "@/lib/cv-builder";
import { CV_TEMPLATES } from "@/lib/cv-builder-types";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

const ERRORS: Record<string, string> = {
  creation: "Le CV n'a pas pu être créé. Réessaie dans un instant.",
  suppression: "Le CV n'a pas pu être supprimé. Réessaie dans un instant.",
  limite: `Tu as atteint la limite de ${CV_BUILDER_MAX} CV : supprimes-en un pour en créer un nouveau.`,
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** « CV Builder » : CV créés dans Applyfy, et création d'un nouveau CV. */
export default async function CvBuilderPage({ searchParams }: PageProps<"/cv-builder">) {
  await connection();
  const { erreur } = await searchParams;
  const error = typeof erreur === "string" ? (ERRORS[erreur] ?? null) : null;

  let cvs: Awaited<ReturnType<typeof listBuilderCvs>> | null = null;
  try {
    cvs = await listBuilderCvs();
  } catch (e) {
    console.error("[cv-builder] liste", e);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">CV Builder</h1>
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">
            Choisis un modèle parmi 5, améliore ton CV avec l&apos;assistant IA et télécharge-le en PDF.
          </p>
        </div>
        {cvs && cvs.length < CV_BUILDER_MAX && (
          <div className="flex flex-wrap items-start gap-2">
            <NewCvDialog />
            <Link href="/cv-builder/importer" className="btn-secondary px-5 py-2.5 text-sm">
              Créer un CV à partir d&apos;un CV existant
            </Link>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30">
          {error}
        </p>
      )}

      {cvs === null ? (
        <p role="alert" className="card p-6 text-sm text-slate-600 dark:text-slate-300">
          Tes CV n&apos;ont pas pu être chargés. Réessaie dans un instant.
        </p>
      ) : cvs.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/20">
            <IconDocument className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Aucun CV pour l&apos;instant</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pars d&apos;un modèle vierge, ou d&apos;un CV que tu as déjà (PDF ou Word) pour
              pré-remplir ton nouveau CV et obtenir son analyse.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cvs.map((cv) => (
            <li key={cv.id} className="card flex flex-col gap-4 p-5">
              <div className="min-w-0">
                <Link
                  href={`/cv-builder/${cv.id}`}
                  className="block truncate font-semibold text-slate-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-300"
                >
                  {cv.title}
                </Link>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {[cv.jobTitle, CV_TEMPLATES.find((t) => t.id === cv.templateId)?.name].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Modifié le {dateFormatter.format(new Date(cv.updatedAt))}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <Link href={`/cv-builder/${cv.id}`} className="btn-secondary px-4 py-2 text-sm">
                  Modifier
                </Link>
                <DeleteBuilderCvButton id={cv.id} title={cv.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
