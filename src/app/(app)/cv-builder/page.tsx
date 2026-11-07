import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { CopyCvForOfferButton } from "@/components/cv-builder/copy-cv-button";
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

/** Page d'une candidature : `replacedTitle` est le CV lié, `canCopy` faux à la limite du nombre de CV. */
type Offer = { applicationId: string; replacedTitle: string | null; canCopy: boolean };

/** Contenu d'une carte de CV : nom, modèle, date et actions. `copyFor` : action « Utiliser pour cette offre ». */
function CvCardContent({ cv, offer, copyFor }: { cv: BuilderCvSummary; offer: Offer | null; copyFor: Offer | null }) {
  return (
    <>
      <div aria-hidden="true" className="h-[86px] w-16 shrink-0 rounded-lg border border-line-strong bg-white px-2 py-[9px] dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-1.5 h-1 w-[70%] rounded-full bg-ink dark:bg-white" />
        <div className="mb-1 h-[3px] rounded-full bg-[#E4E4E7] dark:bg-slate-700" />
        <div className="mb-1 h-[3px] rounded-full bg-[#E4E4E7] dark:bg-slate-700" />
        <div className="h-[3px] w-3/5 rounded-full bg-[#E4E4E7] dark:bg-slate-700" />
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <Link
          href={`/cv-builder/${cv.id}`}
          className="ui-focus block truncate font-semibold text-ink hover:text-accent dark:text-white dark:hover:text-blue-300"
        >
          {cv.title}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-muted dark:text-slate-400">
          {[cv.jobTitle, CV_TEMPLATES.find((t) => t.id === cv.templateId)?.name].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-[13px] text-muted dark:text-slate-400">
          Modifié le {dateFormatter.format(new Date(cv.updatedAt))}
        </p>
      </div>
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:shrink-0">
        <Link href={`/cv-builder/${cv.id}`} className="ui-btn-secondary">
          Modifier
        </Link>
        {copyFor?.canCopy && (
          <CopyCvForOfferButton cvId={cv.id} applicationId={copyFor.applicationId} replacedTitle={copyFor.replacedTitle} />
        )}
        <DeleteBuilderCvButton id={cv.id} title={cv.title} applicationId={offer?.applicationId} />
      </div>
    </>
  );
}

/** Liste de CV, chacun dans sa carte. */
function CvList({ cvs, offer, copyable }: { cvs: BuilderCvSummary[]; offer: Offer | null; copyable: boolean }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {cvs.map((cv) => (
        <li key={cv.id} className="ui-card flex flex-wrap items-center gap-[18px] px-5 py-5 sm:px-6 sm:py-[22px]">
          <CvCardContent cv={cv} offer={offer} copyFor={copyable ? offer : null} />
        </li>
      ))}
    </ul>
  );
}

/** Section de la page d'une candidature : les CV sous leur titre. */
function CvSection({ id, title, ...list }: { id: string; title: string } & Parameters<typeof CvList>[0]) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-[15px] font-semibold text-ink dark:text-white">
        {title}
      </h2>
      <CvList {...list} />
    </section>
  );
}

/**
 * « CV Builder » : CV créés dans Applyfy, et création d'un nouveau CV. Avec `applicationId` (arrivée
 * depuis une fiche) : page de cette candidature, où tout nouveau CV lui est lié.
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
  // Erreur de la dernière action ; sinon, page d'une candidature : limite signalée d'office, ses
  // actions de création étant retirées.
  const error = (typeof erreur === "string" && ERRORS[erreur]) || (detail && full ? ERRORS.limite : null);
  const offer: Offer | null = detail && { applicationId: detail.application.id, replacedTitle: currentCv?.title ?? null, canCopy: !full };
  const importLink = (
    <Link
      href={detail ? `/cv-builder/importer?applicationId=${detail.application.id}` : "/cv-builder/importer"}
      className="ui-btn-secondary"
    >
      {detail ? "Importer un CV" : "Créer un CV à partir d'un CV existant"}
    </Link>
  );
  const heading = detail
    ? [
        "CV",
        detail.application.position.trim() && `pour ${detail.application.position}`,
        detail.application.company.trim() && `chez ${detail.application.company}`,
      ]
        .filter(Boolean)
        .join(" ")
    : "CV Builder";

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page flex-1 space-y-8">
        <div className="space-y-5">
          <div>
            {detail && (
              <Link
                href={`/candidatures/${detail.application.id}`}
                className="ui-focus -my-3 mb-0 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
              >
                Retour à la candidature
              </Link>
            )}
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">{heading}</h1>
            <p className="mt-2 text-muted dark:text-slate-400">
              Choisis un modèle parmi {CV_TEMPLATES.length}, améliore ton CV avec l&apos;assistant IA et télécharge-le en PDF.
            </p>
          </div>
          {cvs && cvs.length < CV_BUILDER_MAX && (
            <div className="flex flex-wrap items-start gap-2">
              {detail && importLink}
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
              />
              {!detail && importLink}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="ui-notice-error px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {cvs === null ? (
          <p role="alert" className="ui-card p-5 sm:p-7 text-sm text-muted dark:text-slate-300">
            Tes CV n&apos;ont pas pu être chargés. Réessaie dans un instant.
          </p>
        ) : cvs.length === 0 ? (
          <div className="ui-card flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200">
              <IconDocument className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-semibold text-ink dark:text-white">Aucun CV pour l&apos;instant</h2>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">
                Pars d&apos;un modèle vierge, ou d&apos;un CV que tu as déjà (PDF ou Word) pour
                pré-remplir ton nouveau CV et obtenir son analyse.
              </p>
            </div>
          </div>
        ) : currentCv ? (
          <>
            <CvSection id="cv-lie" title="CV lié à l'offre" cvs={[currentCv]} offer={offer} copyable={false} />
            {otherCvs.length > 0 && <CvSection id="cv-autres" title="Autres CV" cvs={otherCvs} offer={offer} copyable />}
          </>
        ) : (
          <CvList cvs={otherCvs} offer={offer} copyable />
        )}
      </main>
    </div>
  );
}
