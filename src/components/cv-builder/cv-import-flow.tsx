"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { completeCvImportAction } from "@/app/actions/cv-builder";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { AI_MONTHLY_LIMITS } from "@/lib/ai-usage-limits";
import {
  CV_IMPORT_MAX_BYTES,
  CV_IMPORT_MAX_LABEL,
  type CvAnalysis,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { READY_SCORE, scoreLabel, scoreTone, type CvScore } from "@/lib/cv-score";
import { countLabel } from "@/lib/plan-features";

import { CvImportProgress, type ImportedCv } from "./cv-import-progress";
import { CvReplacementNotice, TemplateChoiceDialog } from "./new-cv-dialog";
import { SCORE_TONES, ScoreGauge } from "./cv-score-card";

const STEPS = ["Import", "Analyse", "Modèle", "Éditeur"] as const;

/**
 * « Créer un CV à partir d'un CV existant », en étapes : 1. import (lecture et analyse par
 * l'IA, gratuite), 2. résultats de l'analyse et poste visé, 3. choix du modèle, 4. l'éditeur,
 * avec le chat initialisé sur les points à améliorer.
 */
export function CvImportFlow({
  resetLabel,
  aiEnabled,
  application = null,
}: {
  resetLabel: string;
  aiEnabled: boolean;
  /**
   * Arrivée depuis une fiche : CV lié à cette candidature, son poste pré-rempli.
   * `linkedCvTitle` : nom du CV déjà lié, que ce nouveau CV remplacera.
   */
  application?: { id: string; position: string; linkedCvTitle: string | null } | null;
}) {
  const router = useRouter();
  // Figé à l'arrivée : le CV importé est lié dès l'extraction, et la page se recharge alors avec lui.
  const [replacedTitle] = useState(application?.linkedCvTitle ?? null);
  const [step, setStep] = useState(0);
  const [imported, setImported] = useState<ImportedCv | null>(null);
  const [targetJob, setTargetJob] = useState((application?.position ?? "").slice(0, 120));
  const templateDialogRef = useRef<HTMLDialogElement>(null);
  const [opening, setOpening] = useState(false);

  async function openEditor(templateId: CvTemplateId = "minimaliste") {
    if (!imported) return;
    setOpening(true);
    setStep(3);
    await completeCvImportAction(imported.id, { templateId, targetJob });
    router.push(`/cv-builder/${imported.id}`);
  }

  function chooseTemplate() {
    setStep(2);
    templateDialogRef.current?.showModal();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href={application ? `/candidatures/${application.id}` : "/cv-builder"}
          className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
        >
          {application ? "Retour à la candidature" : "Mes CV"}
        </Link>
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">
          {application ? "Importer un CV" : "Créer un CV à partir d'un CV existant"}
        </h1>
        {replacedTitle && step === 0 && <CvReplacementNotice title={replacedTitle} />}
        <Stepper current={step} />
      </div>

      {step === 0 && (
        <UploadStep
          resetLabel={resetLabel}
          aiEnabled={aiEnabled}
          applicationId={application?.id}
          onImported={(result) => {
            setImported(result);
            setStep(1);
          }}
        />
      )}

      {step >= 1 && imported && (
        <AnalysisStep
          analysis={imported.analysis}
          score={imported.score}
          targetJob={targetJob}
          onTargetJob={setTargetJob}
          // Le poste vient de la candidature : pas de question, sauf s'il est inutilisable.
          askTargetJob={(application?.position.trim().length ?? 0) < 2}
          onContinue={chooseTemplate}
        />
      )}

      <TemplateChoiceDialog
        dialogRef={templateDialogRef}
        open={step >= 2}
        // Fenêtre fermée sans choisir : retour aux résultats de l'analyse.
        onClose={() => {
          if (!opening) setStep(1);
        }}
        subtitle="Ton CV y est déjà repris."
        footer={(selected) => (
          <>
            <button
              type="button"
              onClick={() => void openEditor()}
              disabled={opening}
              className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            >
              Passer cette étape
            </button>
            <button type="button" onClick={() => void openEditor(selected)} disabled={opening} className="ui-btn-primary">
              {opening ? "Ouverture de l'éditeur…" : "Continuer"}
            </button>
          </>
        )}
      />
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="Étapes" className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className={`h-px w-6 sm:w-10 ${done || active ? "bg-ink dark:bg-white" : "bg-line-strong dark:bg-slate-600"}`} />}
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                  : active
                    ? "bg-white text-ink ring-2 ring-ink dark:bg-slate-900 dark:text-white dark:ring-white"
                    : "bg-pill text-muted dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-semibold text-ink dark:text-white" : "text-muted dark:text-slate-400"}>
              <span className="sr-only">Étape {i + 1} : </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Étape 1 : import
// ---------------------------------------------------------------------------

function UploadStep({
  resetLabel,
  aiEnabled,
  applicationId,
  onImported,
}: {
  resetLabel: string;
  aiEnabled: boolean;
  applicationId?: string;
  onImported: (result: ImportedCv) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Fichier en cours d'import (étapes de CvImportProgress).
  const [pending, setPending] = useState<{ file: File; ext: "pdf" | "docx" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  function onFile(file: File) {
    if (pending) return;
    setError(null);
    setLimitReached(false);
    const ext = file.name.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
    if (!ext) return setError("Choisis un fichier PDF ou Word (.docx).");
    if (file.size > CV_IMPORT_MAX_BYTES) return setError(`Ton CV dépasse ${CV_IMPORT_MAX_LABEL}.`);

    setPending({ file, ext: ext as "pdf" | "docx" });
  }

  if (pending) {
    return (
      <CvImportProgress
        file={pending.file}
        ext={pending.ext}
        applicationId={applicationId}
        onDone={onImported}
        onCancel={() => setPending(null)}
        onLimitReached={() => {
          setPending(null);
          setLimitReached(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && aiEnabled) void onFile(file);
        }}
        className={`flex flex-col items-center gap-4 rounded-[20px] border border-dashed px-5 py-11 text-center transition-colors ${
          dragging ? "border-accent bg-surface dark:bg-slate-800" : "border-line-strong dark:border-slate-700"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </span>
        <div>
          <h2 className="ui-title-sm">Importe ton CV actuel</h2>
          <p className="mt-1 max-w-md text-sm text-muted dark:text-slate-400">
            Applyfy reprend son contenu dans un nouveau CV, lui donne une note sur 100 et te dit quoi améliorer. Avec le plan
            gratuit : {countLabel(AI_MONTHLY_LIMITS.cvb_import, "import", "imports")} de CV par mois.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!aiEnabled}
          className="ui-btn-primary"
        >
          Choisir mon CV
        </button>
        <p className="text-xs text-muted dark:text-slate-400">
          PDF ou Word (.docx), {CV_IMPORT_MAX_LABEL} maximum. Ou glisse-le ici. Le fichier est supprimé dès qu&apos;il est lu.
        </p>
        {!aiEnabled && (
          <p className="text-xs text-muted">Fonctionnalité non activée (clé API Claude manquante).</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {limitReached && (
        <div className="max-w-md">
          <UsageLimitBanner resetLabel={resetLabel} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 : résultats de l'analyse
// ---------------------------------------------------------------------------

/** Sous-étapes de l'analyse : un écran chacune, dans l'étape « Analyse » du stepper. */
const ANALYSIS_SCREENS = ["Score", "Points forts et faibles", "Poste visé", "Optimisations"] as const;

function AnalysisStep({
  analysis,
  score,
  targetJob,
  onTargetJob,
  askTargetJob,
  onContinue,
}: {
  analysis: CvAnalysis | null;
  /** Score calculé par le code (cv-score.ts), le même que dans l'éditeur. */
  score: CvScore;
  targetJob: string;
  onTargetJob: (value: string) => void;
  askTargetJob: boolean;
  onContinue: () => void;
}) {
  const screens = ANALYSIS_SCREENS.filter((label) => askTargetJob || label !== "Poste visé");
  const [screen, setScreen] = useState(0);
  const headingRef = useRef<HTMLDivElement>(null);

  if (!analysis) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="ui-card p-5 sm:p-7 text-sm text-muted dark:text-slate-300">
          Ton CV est bien importé, mais son analyse n&apos;a pas pu être faite. Tu peux continuer : l&apos;assistant IA de
          l&apos;éditeur t&apos;aidera à l&apos;améliorer.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onContinue} className="ui-btn-primary">
            Choisir mon modèle de CV
          </button>
        </div>
      </div>
    );
  }

  const current = screens[screen];
  const last = screen === screens.length - 1;
  function go(next: number) {
    setScreen(next);
    // Nouvel écran : retour en haut, focus sur son contenu (lecteurs d'écran).
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div ref={headingRef} tabIndex={-1} className="flex scroll-mt-22 items-center justify-between gap-3 outline-none">
        <p className="text-sm font-medium text-muted dark:text-slate-400">
          {screen + 1}/{screens.length} · {current}
        </p>
        <div aria-hidden="true" className="flex gap-1.5">
          {screens.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 w-6 rounded-full ${i <= screen ? "bg-accent" : "bg-pill dark:bg-slate-700"}`}
            />
          ))}
        </div>
      </div>

      {current === "Score" && <ScoreCard score={score} />}
      {current === "Points forts et faibles" && <PointsCard analysis={analysis} />}
      {current === "Poste visé" && <TargetJobCard suggestions={analysis.suggestedJobs} value={targetJob} onChange={onTargetJob} />}
      {current === "Optimisations" && <OptimizationsCard analysis={analysis} />}

      <div className="flex items-center justify-between gap-3">
        {screen > 0 ? (
          <button
            type="button"
            onClick={() => go(screen - 1)}
            className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            Retour
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => (last ? onContinue() : go(screen + 1))} className="ui-btn-primary">
          {screen === 0 ? "Voir les points forts et faibles" : last ? "Choisir mon modèle de CV" : "Continuer"}
        </button>
      </div>
    </div>
  );
}

function CardTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="ui-title-sm">
      {children}
    </h2>
  );
}

function ScoreCard({ score }: { score: CvScore }) {
  const titleId = useId();
  const t = SCORE_TONES[scoreTone(score.score)];
  return (
    <section aria-labelledby={titleId} className="ui-card space-y-5 p-5 sm:p-7">
      <CardTitle id={titleId}>Score de ton CV</CardTitle>
      <div className="flex items-center gap-5">
        <ScoreGauge score={score.score} />
        <div>
          <p className={`font-semibold ${t.text}`}>{scoreLabel(score.score)}</p>
          <p className="mt-1 text-sm text-muted dark:text-slate-400">{READY_SCORE} = prêt à postuler</p>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Catégories évaluées">
        {score.categories.map((c) => {
          // Couleur de la catégorie : même seuils que le score, rapportés à 100.
          const ct = SCORE_TONES[scoreTone((c.score / c.max) * 100)];
          return (
            <li key={c.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-ink dark:text-slate-200">{c.label}</span>
                <span className="font-medium text-muted dark:text-slate-400">
                  {c.score}/{c.max}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-pill dark:bg-slate-800">
                <div className={`h-full rounded-full ${ct.bar}`} style={{ width: `${(c.score / c.max) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PointsCard({ analysis }: { analysis: CvAnalysis }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="ui-card space-y-5 p-5 sm:p-7">
      <CardTitle id={titleId}>Points forts et points à améliorer</CardTitle>
      {analysis.positives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Points positifs</h3>
          <ul className="space-y-1.5">
            {analysis.positives.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-ink dark:text-slate-200">
                <span aria-hidden="true" className="font-bold text-ink dark:text-white">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.improvements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Points à améliorer</h3>
          <ul className="space-y-1.5">
            {analysis.improvements.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-ink dark:text-slate-200">
                <span aria-hidden="true" className="font-bold text-red-600 dark:text-red-400">✗</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TargetJobCard({
  suggestions,
  value,
  onChange,
}: {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const titleId = useId();
  const inputId = useId();
  return (
    <section aria-labelledby={titleId} className="ui-card space-y-4 p-5 sm:p-7">
      <div>
        <CardTitle id={titleId}>Quel type de poste tu vises ?</CardTitle>
        <p className="mt-1 text-sm text-muted dark:text-slate-400">
          L&apos;assistant s&apos;en servira pour adapter ton CV à ce type de poste.
        </p>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((job) => {
            const active = value.trim().toLowerCase() === job.toLowerCase();
            return (
              <button
                key={job}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(active ? "" : job)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-line bg-accent text-white"
                    : "border-line bg-white text-ink hover:border-line hover:bg-pill hover:text-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-accent/15 dark:hover:text-accent"
                }`}
              >
                {job}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink dark:text-slate-200">
          {suggestions.length > 0 ? "Ou écris-le toi-même" : "Poste visé"}
        </label>
        <input
          id={inputId}
          value={value}
          maxLength={120}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex. Data Analyst"
          className="ui-input w-full"
        />
      </div>
    </section>
  );
}

/** Optimisations de l'analyse : informatives, le coach les traite lui-même dans l'éditeur. */
function OptimizationsCard({ analysis }: { analysis: CvAnalysis }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="ui-card space-y-4 p-5 sm:p-7">
      <div>
        <CardTitle id={titleId}>Optimisations suggérées</CardTitle>
        <p className="mt-1 text-sm text-muted dark:text-slate-400">
          Les priorités pour ton CV. Dans l&apos;éditeur, le coach les traitera avec toi une par une.
        </p>
      </div>
      {analysis.optimizations.length > 0 ? (
        <ol className="space-y-2">
          {analysis.optimizations.map((o, i) => (
            <li key={o.title} className="flex gap-3 p-2">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-box text-xs font-semibold text-ink dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink dark:text-white">{o.title}</span>
                {o.detail && <span className="mt-0.5 block text-sm text-muted dark:text-slate-400">{o.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted dark:text-slate-400">Aucune optimisation prioritaire : ton CV est déjà solide.</p>
      )}
    </section>
  );
}
