import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DeleteBuilderCvButton } from "@/components/cv-builder/delete-cv-button";
import { NewCvDialog } from "@/components/cv-builder/new-cv-dialog";
import { IconDocument } from "@/components/icons";
import { getApplicationDetail } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { CV_BUILDER_MAX, getBuilderCvByApplication, listBuilderCvs } from "@/lib/cv-builder";
import { CV_TEMPLATES, type BuilderCvSummary } from "@/lib/cv-builder-types";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

// CV d'une candidature (Server Action de cette page) : mots-clés de l'offre, jusqu'à une minute.
export const maxDuration = 120;

const ERRORS: Record<string, string> = {
  creation: "Le CV n'a pas pu être créé. Réessaie dans un instant.",
  suppression: "Le CV n'a pas pu être supprimé. Réessaie dans un instant.",
  limite: `Tu as atteint la limite de ${CV_BUILDER_MAX} CV : supprimes-en un pour en créer un nouveau.`,
  conversion: "Ton ancien CV n'a pas pu être repris. Réessaie dans un instant, ou crée ton CV autrement.",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Contenu d'une carte de CV : nom, modèle, date et actions. */
function CvCardContent({ cv }: { cv: BuilderCvSummary }) {
  return (
    <>
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
    </>
  );
}

/**
 * « CV Builder » : CV créés dans Applyfy, et création d'un nouveau CV. Avec `applicationId` (arrivée
 * depuis une fiche) : page de cette candidature, son CV en tête, et tout nouveau CV lui est lié.
 */
export default async function CvBuilderPage({ searchParams }: PageProps<"/cv-builder">) {
  await connection();
  const { erreur, applicationId } = await searchParams;

  // Candidature de l'utilisateur, vérifiée ici.
  const detail = typeof applicationId === "string" ? await getApplicationDetail(applicationId) : null;
  const linked = detail ? await getBuilderCvByApplication(detail.application.id) : null;

  let cvs: BuilderCvSummary[] | null = null;
  try {
    cvs = await listBuilderCvs();
  } catch (e) {
    console.error("[cv-builder] liste", e);
  }
  const currentCv = linked ? (cvs?.find((cv) => cv.id === linked.id) ?? null) : null;
  const otherCvs = cvs?.filter((cv) => cv.id !== currentCv?.id) ?? [];
  const full = cvs !== null && cvs.length >= CV_BUILDER_MAX;
  // Limite signalée d'office seulement quand il faut créer le CV de cette candidature.
  const error = detail && !linked && full ? ERRORS.limite : typeof erreur === "string" ? (ERRORS[erreur] ?? null) : null;
  const heading = detail
    ? `CV pour ${detail.application.position}${detail.application.company.trim() ? ` chez ${detail.application.company}` : ""}`
    : "CV Builder";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{heading}</h1>
          {detail && (
            <Link
              href={`/candidatures/${detail.application.id}`}
              className="mt-1.5 inline-block text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← Retour à la candidature
            </Link>
          )}
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">
            Choisis un modèle parmi 5, améliore ton CV avec l&apos;assistant IA et télécharge-le en PDF.
          </p>
        </div>
        {cvs && cvs.length < CV_BUILDER_MAX && (
          <div className="flex flex-wrap items-start gap-2">
            <NewCvDialog
              application={
                detail && {
                  id: detail.application.id,
                  position: detail.application.position,
                  // La conversion passe par l'IA, et seulement tant qu'aucun CV n'est lié.
                  hasLegacyCv: !linked && Boolean(detail.application.cv_improved_html) && isClaudeConfigured(),
                  linkedCvTitle: linked?.title ?? null,
                }
              }
              autoOpen={Boolean(detail && !linked)}
              error={detail ? error : null}
            />
            <Link
              href={detail ? `/cv-builder/importer?applicationId=${detail.application.id}` : "/cv-builder/importer"}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
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
        <>
          {currentCv && (
            <section
              aria-label="CV actuel pour cette offre"
              className="card flex flex-col gap-4 bg-blue-50/60 p-5 ring-2 ring-blue-600 dark:bg-blue-500/10 dark:ring-blue-400"
            >
              <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                CV actuel pour cette offre
              </span>
              <CvCardContent cv={currentCv} />
            </section>
          )}
          {otherCvs.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {otherCvs.map((cv) => (
                <li key={cv.id} className="card flex flex-col gap-4 p-5">
                  <CvCardContent cv={cv} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
