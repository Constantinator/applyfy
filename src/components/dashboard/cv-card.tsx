import Link from "next/link";

import { IconDocument } from "@/components/icons";
import { READY_SCORE } from "@/lib/cv-score";
import type { Sector } from "@/lib/cv-sector-context";
import { FUNCTION_TINTS, SUCCESS_PILL } from "@/lib/ui-tints";

import { AnimatedScoreGauge } from "./animated-score-gauge";

export type LatestCv = {
  id: string;
  title: string;
  score: number;
  /** Catégorie du score à travailler d'abord (null : CV prêt ou détail indisponible). */
  weakPoint: string | null;
  /** Secteur détecté et poste visé (« Offres pour toi »). */
  sector: Sector;
  targetJob: string;
};

/** Carte « Ton CV » : score du dernier CV modifié (mêmes couleurs de jauge que l'éditeur). */
export function CvCard({ cv }: { cv: LatestCv | null }) {
  const missing = cv ? READY_SCORE - cv.score : 0;
  return (
    <section aria-labelledby="cv-title" className="ui-card flex min-w-0 flex-col gap-4 p-5 sm:p-7">
      <h2 id="cv-title" className="ui-title">
        {cv ? "Ton CV" : "Crée ton CV"}
      </h2>

      {cv ? (
        <>
          <div className="flex items-center gap-4">
            <div role="img" aria-label={`Score du CV : ${cv.score} sur 100`} className="shrink-0">
              <AnimatedScoreGauge score={cv.score} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold break-words text-ink dark:text-white">{cv.title}</p>
              <p className="mt-1 text-[13px] text-muted dark:text-slate-300">
                {missing > 0
                  ? `Encore ${missing} point${missing > 1 ? "s" : ""} pour être prêt à postuler`
                  : "Ton CV est prêt à postuler"}
              </p>
              {cv.score >= READY_SCORE && <span className={`mt-2 ${SUCCESS_PILL}`}>Prêt à envoyer</span>}
            </div>
          </div>
          {cv.weakPoint && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#F6F6F6] px-3.5 py-3 dark:bg-slate-800/50">
              <p className="min-w-0 text-[13px] text-ink dark:text-slate-200">
                Point faible : <strong className="font-semibold">{cv.weakPoint}</strong>
              </p>
              <Link
                href={`/cv-builder/${cv.id}?onglet=chat`}
                aria-label={`Améliorer ${cv.weakPoint} avec le coach`}
                className="ui-btn-secondary"
              >
                Améliorer
              </Link>
            </div>
          )}
          <Link href={`/cv-builder/${cv.id}?onglet=chat`} className="ui-btn-primary w-full">
            Continuer avec le coach
          </Link>
          <Link
            href="/cv-builder"
            className="ui-focus inline-flex min-h-11 items-center justify-center text-[13px] font-medium text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
          >
            Voir tous mes CV
          </Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${FUNCTION_TINTS.cv}`}
            >
              <IconDocument className="h-5 w-5" />
            </span>
            <p className="min-w-0 text-[13px] text-muted dark:text-slate-300">
              Pars de zéro ou importe ton CV : le coach t&apos;aide à l&apos;améliorer, point par point.
            </p>
          </div>
          <Link href="/cv-builder" className="ui-btn-primary w-full">
            Créer ton CV
          </Link>
        </>
      )}
    </section>
  );
}
