"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { checkCoachQuestionAction, completeCvImportAction, importBuilderCvAction } from "@/app/actions/cv-builder";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import {
  CV_IMPORT_FOLDER,
  CV_IMPORT_MAX_BYTES,
  CV_IMPORT_MAX_LABEL,
  type CvAnalysis,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { scoreTone, type CvScore } from "@/lib/cv-score";
import { createClient } from "@/lib/supabase/client";

import { TemplateChoiceDialog } from "./new-cv-dialog";
import { SCORE_TONES, ScoreGauge, scoreLabel } from "./cv-score-card";

type ImportedCv = { id: string; analysis: CvAnalysis | null; score: CvScore };

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const TYPES: Record<string, { ext: "pdf" | "docx"; mime: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

const STEPS = ["Import", "Analyse", "Modèle", "Éditeur"] as const;

/**
 * Le fichier est déposé dans le stockage privé de l'utilisateur puis lu par le serveur : un
 * CV de 5 Mo dépasse la taille maximale d'une requête vers le serveur (4,5 Mo sur Vercel).
 * Mode démo (sans Supabase) : envoyé avec la requête.
 */
async function sendForImport(file: File, ext: "pdf" | "docx") {
  const formData = new FormData();
  // Taille d'origine : le serveur vérifie qu'il lit bien le fichier entier.
  formData.set("size", String(file.size));
  if (!SUPABASE_CONFIGURED) {
    formData.set("file", file);
    return importBuilderCvAction(formData);
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, error: "Ta session a expiré : reconnecte-toi." };
  const path = `${data.user.id}/${CV_IMPORT_FOLDER}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: TYPES[ext].mime });
  if (error) {
    console.error("[cv-builder] dépôt de l'import", error.message);
    return { ok: false as const, error: "Le fichier n'a pas pu être envoyé. Réessaie." };
  }
  formData.set("path", path);
  return importBuilderCvAction(formData);
}

/**
 * « Créer un CV à partir d'un CV existant », en étapes : 1. import (lecture et analyse par
 * l'IA, gratuite), 2. résultats de l'analyse et poste visé, 3. choix du modèle, 4. l'éditeur,
 * avec le chat initialisé sur les points à améliorer.
 */
export function CvImportFlow({ resetLabel, aiEnabled }: { resetLabel: string; aiEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [imported, setImported] = useState<ImportedCv | null>(null);
  const [targetJob, setTargetJob] = useState("");
  // Optimisation choisie d'un clic : le premier message du coach sera une question sur ce point.
  const [focus, setFocus] = useState("");
  const templateDialogRef = useRef<HTMLDialogElement>(null);
  const [opening, setOpening] = useState(false);

  async function openEditor(templateId: CvTemplateId = "minimaliste") {
    if (!imported) return;
    setOpening(true);
    setStep(3);
    await completeCvImportAction(imported.id, { templateId, targetJob, focus });
    router.push(`/cv-builder/${imported.id}`);
  }

  function chooseTemplate() {
    setStep(2);
    templateDialogRef.current?.showModal();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/cv-builder" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Mes CV
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Créer un CV à partir d&apos;un CV existant
        </h1>
        <Stepper current={step} />
      </div>

      {step === 0 && (
        <UploadStep
          resetLabel={resetLabel}
          aiEnabled={aiEnabled}
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
          onContinue={() => {
            setFocus("");
            chooseTemplate();
          }}
          onPickFocus={(point) => {
            setFocus(point);
            chooseTemplate();
          }}
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
              className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            >
              Passer cette étape
            </button>
            <button type="button" onClick={() => void openEditor(selected)} disabled={opening} className="btn-primary px-6 py-2.5 text-sm">
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
            {i > 0 && <span aria-hidden="true" className={`h-px w-6 sm:w-10 ${done || active ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`} />}
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-blue-600 text-white"
                  : active
                    ? "bg-blue-50 text-blue-700 ring-2 ring-blue-600 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}>
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
  onImported,
}: {
  resetLabel: string;
  aiEnabled: boolean;
  onImported: (result: ImportedCv) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function onFile(file: File) {
    if (pending) return;
    setError(null);
    setLimitReached(false);
    const ext = file.name.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
    if (!ext) return setError("Choisis un fichier PDF ou Word (.docx).");
    if (file.size > CV_IMPORT_MAX_BYTES) return setError(`Ton CV dépasse ${CV_IMPORT_MAX_LABEL}.`);

    setPending(true);
    try {
      const result = await sendForImport(file, ext as "pdf" | "docx");
      if (result.ok) return onImported({ id: result.id, analysis: result.analysis, score: result.score });
      if ("limitReached" in result && result.limitReached) setLimitReached(true);
      else setError(result.error);
    } catch (e) {
      console.error("[cv-builder] import", e);
      setError("L'import a échoué. Réessaie dans un instant.");
    }
    setPending(false);
  }

  if (pending) {
    return (
      <div role="status" className="card flex flex-col items-center gap-4 p-10 text-center">
        <span
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 motion-reduce:animate-none dark:border-blue-500/20 dark:border-t-blue-400"
        />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Analyse de ton CV en cours…</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Applyfy récupère tes informations pour remplir ton nouveau CV. Cela prend quelques secondes.
          </p>
        </div>
      </div>
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
        className={`card flex flex-col items-center gap-4 border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/20">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </span>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Importe ton CV actuel</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Applyfy reprend son contenu dans un nouveau CV, lui donne une note sur 100 et te dit quoi améliorer. L&apos;analyse
            est gratuite.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!aiEnabled}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          Choisir mon CV
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          PDF ou Word (.docx), {CV_IMPORT_MAX_LABEL} maximum. Ou glisse-le ici. Le fichier est supprimé dès qu&apos;il est lu.
        </p>
        {!aiEnabled && (
          <p className="text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
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
  onContinue,
  onPickFocus,
}: {
  analysis: CvAnalysis | null;
  /** Score calculé par le code (cv-score.ts), le même que dans l'éditeur. */
  score: CvScore;
  targetJob: string;
  onTargetJob: (value: string) => void;
  onContinue: () => void;
  /** Optimisation choisie d'un clic : le coach ouvrira l'éditeur par une question sur ce point. */
  onPickFocus: (point: string) => void;
}) {
  const [screen, setScreen] = useState(0);
  const headingRef = useRef<HTMLDivElement>(null);

  if (!analysis) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="card p-6 text-sm text-slate-600 dark:text-slate-300">
          Ton CV est bien importé, mais son analyse n&apos;a pas pu être faite. Tu peux continuer : l&apos;assistant IA de
          l&apos;éditeur t&apos;aidera à l&apos;améliorer.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onContinue} className="btn-primary px-6 py-2.5 text-sm">
            Choisir mon modèle de CV
          </button>
        </div>
      </div>
    );
  }

  const last = screen === ANALYSIS_SCREENS.length - 1;
  function go(next: number) {
    setScreen(next);
    // Nouvel écran : retour en haut, focus sur son contenu (lecteurs d'écran).
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div ref={headingRef} tabIndex={-1} className="flex items-center justify-between gap-3 outline-none">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {screen + 1}/{ANALYSIS_SCREENS.length} · {ANALYSIS_SCREENS[screen]}
        </p>
        <div aria-hidden="true" className="flex gap-1.5">
          {ANALYSIS_SCREENS.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 w-6 rounded-full ${i <= screen ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}
            />
          ))}
        </div>
      </div>

      {screen === 0 && <ScoreCard score={score} />}
      {screen === 1 && <PointsCard analysis={analysis} />}
      {screen === 2 && <TargetJobCard suggestions={analysis.suggestedJobs} value={targetJob} onChange={onTargetJob} />}
      {screen === 3 && <OptimizationsCard analysis={analysis} onPick={onPickFocus} />}

      <div className="flex items-center justify-between gap-3">
        {screen > 0 ? (
          <button
            type="button"
            onClick={() => go(screen - 1)}
            className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            Retour
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => (last ? onContinue() : go(screen + 1))} className="btn-primary px-6 py-2.5 text-sm">
          {screen === 0 ? "Voir les points forts et faibles" : last ? "Choisir mon modèle de CV" : "Continuer"}
        </button>
      </div>
    </div>
  );
}

function CardTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="font-semibold text-slate-900 dark:text-white">
      {children}
    </h2>
  );
}

function ScoreCard({ score }: { score: CvScore }) {
  const titleId = useId();
  const t = SCORE_TONES[scoreTone(score.score)];
  return (
    <section aria-labelledby={titleId} className="card space-y-5 p-5">
      <CardTitle id={titleId}>Score de ton CV</CardTitle>
      <div className="flex items-center gap-5">
        <ScoreGauge score={score.score} />
        <div>
          <p className={`font-semibold ${t.text}`}>{scoreLabel(score.score)}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">90 = prêt à postuler</p>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Catégories évaluées">
        {score.categories.map((c) => {
          // Couleur de la catégorie : même seuils que le score, rapportés à 100.
          const ct = SCORE_TONES[scoreTone((c.score / c.max) * 100)];
          return (
            <li key={c.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {c.score}/{c.max}
                </span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
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
    <section aria-labelledby={titleId} className="card space-y-5 p-5">
      <CardTitle id={titleId}>Points forts et points à améliorer</CardTitle>
      {analysis.positives.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Points positifs</h3>
          <ul className="space-y-1.5">
            {analysis.positives.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span aria-hidden="true" className="font-bold text-green-600 dark:text-green-400">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.improvements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Points à améliorer</h3>
          <ul className="space-y-1.5">
            {analysis.improvements.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
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
    <section aria-labelledby={titleId} className="card space-y-4 p-5">
      <div>
        <CardTitle id={titleId}>Quel type de poste tu vises ?</CardTitle>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
                }`}
              >
                {job}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {suggestions.length > 0 ? "Ou écris-le toi-même" : "Poste visé"}
        </label>
        <input
          id={inputId}
          value={value}
          maxLength={120}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex. Data Analyst"
          className="input w-full"
        />
      </div>
    </section>
  );
}

function OptimizationsCard({ analysis, onPick }: { analysis: CvAnalysis; onPick: (point: string) => void }) {
  const titleId = useId();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Coach disponible (quota) avant de retenir le point ; sinon un message, rien n'est demandé.
  async function pick(point: string) {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    const result = await checkCoachQuestionAction().catch(() => ({ ok: false as const, error: "Réessaie dans un instant." }));
    setChecking(false);
    if (result.ok) onPick(point);
    else setNotice(result.error);
  }

  return (
    <section aria-labelledby={titleId} className="card space-y-4 p-5">
      <div>
        <CardTitle id={titleId}>Optimisations suggérées</CardTitle>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Les priorités pour ton CV. Clique sur l&apos;une d&apos;elles : dans l&apos;éditeur, le coach te posera
          d&apos;abord une question sur ce point.
        </p>
      </div>
      {analysis.optimizations.length > 0 ? (
        <ol className="space-y-2">
          {analysis.optimizations.map((o, i) => (
            <li key={o.title}>
              <button
                type="button"
                onClick={() => void pick(o.detail ? `${o.title} — ${o.detail}` : o.title)}
                disabled={checking}
                className="flex w-full gap-3 rounded-lg disabled:opacity-60 border border-transparent p-2 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10"
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">{o.title}</span>
                  {o.detail && <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{o.detail}</span>}
                </span>
                <span aria-hidden="true" className="self-center text-sm font-medium text-blue-700 dark:text-blue-300">
                  Corriger →
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Aucune optimisation prioritaire : ton CV est déjà solide.</p>
      )}
      {notice && (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          {notice}
        </p>
      )}
    </section>
  );
}
