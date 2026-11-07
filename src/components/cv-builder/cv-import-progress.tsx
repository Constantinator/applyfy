"use client";

import { useEffect, useRef, useState } from "react";

import {
  analyseCvImportAction,
  checkCvImportAction,
  coachOpeningAction,
  compareCvMarketAction,
  detectCvTargetAction,
  extractCvImportAction,
  scoreCvImportAction,
  type ImportStepResult,
} from "@/app/actions/cv-builder";
import { CV_IMPORT_FOLDER, type CvAnalysis } from "@/lib/cv-builder-types";
import type { CvScore } from "@/lib/cv-score";
import { createClient } from "@/lib/supabase/client";

/** CV importé, prêt pour les résultats de l'analyse. */
export type ImportedCv = { id: string; analysis: CvAnalysis | null; score: CvScore };

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Étapes affichées : chacune correspond à une action serveur, cochée à sa réponse. */
const STEPS = [
  "Lecture du fichier",
  "Extraction du CV (expériences, formation, compétences)",
  "Détection de ton secteur et du poste visé",
  "Comparaison avec les offres du marché",
  "Notation du CV",
  "Génération de conseils personnalisés",
  "Préparation de ton coach",
] as const;
const COACH_STEP = STEPS.length - 1;

/** Ce que les étapes déjà terminées ont produit (une étape reprend là où la précédente s'est arrêtée). */
type Progress = { path?: string; id?: string; score?: CvScore; analysis?: CvAnalysis | null };

type StepError = { step: number; message: string };

/**
 * Dépôt du fichier dans le stockage privé de l'utilisateur : un CV de 5 Mo dépasse la taille
 * maximale d'une requête vers le serveur (4,5 Mo sur Vercel). Mode démo (sans Supabase) : le
 * fichier est envoyé avec chaque requête qui le lit.
 */
async function uploadImport(file: File, ext: "pdf" | "docx"): Promise<ImportStepResult<string | null>> {
  if (!SUPABASE_CONFIGURED) return { ok: true, value: null };
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const path = `${data.user.id}/${CV_IMPORT_FOLDER}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: MIME[ext] });
  if (error) {
    console.error("[cv-builder] dépôt de l'import", error.message);
    return { ok: false, error: "Le fichier n'a pas pu être envoyé. Réessaie." };
  }
  return { ok: true, value: path };
}

function fileForm(file: File, path: string | undefined, applicationId?: string) {
  const formData = new FormData();
  if (applicationId) formData.set("applicationId", applicationId);
  // Taille d'origine : le serveur vérifie qu'il lit bien le fichier entier.
  formData.set("size", String(file.size));
  if (path) formData.set("path", path);
  else formData.set("file", file);
  return formData;
}

function StepIcon({ state }: { state: "done" | "current" | "error" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white dark:bg-white dark:text-slate-900">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent motion-reduce:animate-none dark:border-blue-500/20 dark:border-t-blue-400"
      />
    );
  }
  if (state === "error") {
    return (
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
        !
      </span>
    );
  }
  return <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-2 border-line dark:border-slate-700" />;
}

/**
 * Import d'un CV en étapes réelles : chaque étape est une action serveur, appelée l'une après
 * l'autre et cochée à sa réponse. Étape en échec : message et bouton Réessayer, qui reprend à
 * cette étape. Essai du mois épuisé : retour à l'écran d'import (`onLimitReached`).
 */
export function CvImportProgress({
  file,
  ext,
  applicationId,
  onDone,
  onCancel,
  onLimitReached,
}: {
  file: File;
  ext: "pdf" | "docx";
  /** Candidature à laquelle lier le CV importé. */
  applicationId?: string;
  onDone: (result: ImportedCv) => void;
  onCancel: () => void;
  onLimitReached: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<StepError | null>(null);
  const progress = useRef<Progress>({});
  const started = useRef(false);

  /** Une étape : son action serveur, qui complète la progression (ou son erreur). */
  async function runStep(step: number): Promise<ImportStepResult<null>> {
    const p = progress.current;
    switch (step) {
      case 0: {
        const uploaded = await uploadImport(file, ext);
        if (!uploaded.ok) return uploaded;
        p.path = uploaded.value ?? undefined;
        const checked = await checkCvImportAction(fileForm(file, p.path));
        return checked.ok ? { ok: true, value: null } : checked;
      }
      case 1: {
        const extracted = await extractCvImportAction(fileForm(file, p.path, applicationId));
        if (!extracted.ok) return extracted;
        p.id = extracted.value.id;
        return { ok: true, value: null };
      }
      case 2: {
        const target = await detectCvTargetAction(p.id!);
        return target.ok ? { ok: true, value: null } : target;
      }
      case 3: {
        const market = await compareCvMarketAction(p.id!);
        return market.ok ? { ok: true, value: null } : market;
      }
      case 4: {
        const scored = await scoreCvImportAction(p.id!);
        if (!scored.ok) return scored;
        p.score = scored.value;
        return { ok: true, value: null };
      }
      case 5: {
        const analysed = await analyseCvImportAction(p.id!);
        if (!analysed.ok) return analysed;
        p.analysis = analysed.value;
        return { ok: true, value: null };
      }
      default: {
        const coach = await coachOpeningAction(p.id!);
        return coach.ok ? { ok: true, value: null } : { ok: false, error: "Ton coach n'a pas pu être préparé." };
      }
    }
  }

  /** Enchaîne les étapes à partir de `from` ; s'arrête à la première en échec. */
  async function runFrom(from: number) {
    setError(null);
    for (let step = from; step < STEPS.length; step++) {
      setCurrent(step);
      let result: ImportStepResult<null>;
      try {
        result = await runStep(step);
      } catch (e) {
        console.error(`[cv-builder] import, étape ${step + 1}`, e);
        result = { ok: false, error: "Cette étape n'a pas abouti. Réessaie dans un instant." };
      }
      if (!result.ok) {
        if (result.limitReached) return onLimitReached();
        setError({ step, message: result.error });
        return;
      }
    }
    setCurrent(STEPS.length);
    finish();
  }

  function finish() {
    const { id, score, analysis } = progress.current;
    if (id && score) onDone({ id, score, analysis: analysis ?? null });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runFrom(0);
    // runFrom lit l'état courant : l'import ne démarre qu'une fois, à l'affichage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ui-card mx-auto max-w-xl space-y-5 p-5 sm:p-7">
      <div>
        <h2 className="ui-title-sm">Analyse de ton CV</h2>
        <p className="mt-1 text-sm text-muted dark:text-slate-400">{file.name}</p>
      </div>
      <ol className="space-y-3" aria-label="Étapes de l'analyse">
        {STEPS.map((label, step) => {
          const state = error?.step === step ? "error" : step < current ? "done" : step === current ? "current" : "todo";
          return (
            <li key={label} className="flex gap-3" aria-current={state === "current" ? "step" : undefined}>
              <StepIcon state={state} />
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm ${
                    state === "todo"
                      ? "text-muted dark:text-slate-500"
                      : state === "error"
                        ? "font-medium text-red-700 dark:text-red-300"
                        : state === "current"
                          ? "font-medium text-ink dark:text-white"
                          : "text-ink dark:text-slate-200"
                  }`}
                >
                  {label}
                  <span className="sr-only">
                    {state === "done" ? " (terminé)" : state === "current" ? " (en cours)" : state === "error" ? " (échec)" : ""}
                  </span>
                </p>
                {state === "error" && error && (
                  <div className="mt-2 space-y-2">
                    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                      {error.message}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void runFrom(error.step)} className="ui-btn-primary">
                        Réessayer
                      </button>
                      {/* Le coach se prépare aussi à l'ouverture de l'éditeur : l'import peut continuer sans lui. */}
                      {error.step === COACH_STEP ? (
                        <button type="button" onClick={finish} className="ui-btn-secondary">
                          Continuer sans
                        </button>
                      ) : (
                        error.step <= 1 && (
                          <button type="button" onClick={onCancel} className="ui-btn-secondary">
                            Choisir un autre fichier
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
