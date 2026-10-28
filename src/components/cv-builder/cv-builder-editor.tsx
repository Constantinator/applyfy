"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  coachOpeningAction,
  refineBuilderCvAction,
  saveBuilderCvAction,
  scoringContextAction,
} from "@/app/actions/cv-builder";
import { RefineChat } from "@/components/application/refine-chat";
import { useAppNav } from "@/components/app-nav-context";
import { CVB_CHAT_LIMIT_MESSAGE, type AiUsageCount } from "@/lib/ai-usage-limits";
import {
  applyEdit,
  chatContent,
  CV_LIMITS,
  CvDataSchema,
  fullName,
  type BuilderCv,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { bannedPhrasesInCv, scoreCv, type ScoringContext } from "@/lib/cv-score";

import { CvHtmlPreview } from "./cv-html-preview";
import { CvScorePanel } from "./cv-score-card";

export type CvBuilderUsage = {
  /** Chat « Affiner avec l'IA » : utilisation du mois. */
  chat: AiUsageCount;
  resetLabel: string;
  /** Clé API Claude configurée. */
  aiEnabled: boolean;
};

type SaveStatus = "saved" | "pending" | "saving" | "error";

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: "Enregistré",
  pending: "Modifications en cours…",
  saving: "Enregistrement…",
  error: "Échec de l'enregistrement",
};

const LEAVE_MESSAGE = "Des modifications ne sont pas encore enregistrées. Quitter quand même ?";

function fileName(title: string, data: CvData) {
  const base = `CV ${fullName(data) || title}`.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${base.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-") || "CV"}.pdf`;
}

/**
 * Éditeur du CV Builder : chat « coach » à gauche (40 %) et aperçu du CV à droite (60 %),
 * modifiable d'un clic sur un texte. Le coach ouvre la conversation sur le point le plus
 * faible du CV, pose ses questions et intègre les réponses au CV.
 */
export function CvBuilderEditor({
  cv,
  usage,
  scoring,
}: {
  cv: BuilderCv;
  usage: CvBuilderUsage;
  /** Données du secteur pour le score (détecté à l'ouverture). */
  scoring: ScoringContext;
}) {
  const [title, setTitle] = useState(cv.title);
  // Modèle choisi à la création du CV : plus modifiable dans l'éditeur.
  const templateId: CvTemplateId = cv.templateId;
  const [data, setData] = useState<CvData>(cv.data);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pages, setPages] = useState(1);
  const version = useRef(0);
  const touched = useRef(false);
  // Dernières données, lues par le chat au moment d'un envoi ou d'une annulation.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const edit = (fn: (d: CvData) => CvData) => {
    touched.current = true;
    setStatus("pending");
    setData(fn);
  };

  // Sauvegarde automatique, une seconde après la dernière modification.
  useEffect(() => {
    if (!touched.current) return;
    const current = ++version.current;
    const timer = setTimeout(async () => {
      setStatus("saving");
      const result = await saveBuilderCvAction(cv.id, { title, templateId, data });
      if (current !== version.current) return; // une modification plus récente suivra
      setStatus(result.ok ? "saved" : "error");
      setSaveError(result.ok ? null : result.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cv.id, title, templateId, data]);

  // Quitter la page avec des modifications non enregistrées : confirmation du navigateur
  // (fermeture, rechargement) ; dans l'application (Retour, liens du Menu), confirmation aussi.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  const { openMenu, setLeaveGuard } = useAppNav();
  const canLeave = useCallback(() => status === "saved" || window.confirm(LEAVE_MESSAGE), [status]);
  useEffect(() => {
    setLeaveGuard(canLeave);
    return () => setLeaveGuard(null);
  }, [canLeave, setLeaveGuard]);

  // Score calculé par le code (cv-score.ts), recalculé à chaque modification du CV.
  const [scoringContext, setScoringContext] = useState(scoring);
  const score = useMemo(() => scoreCv(data, scoringContext), [data, scoringContext]);
  // Formules de la liste noire présentes dans le CV (elles comptent aussi dans le score).
  const banned = useMemo(() => bannedPhrasesInCv(data, scoringContext), [data, scoringContext]);

  // Poste cible modifié (titre du CV ou poste visé) : secteur redétecté par le serveur.
  const target = `${data.personal.jobTitle.trim()}|${data.analysis?.targetJob.trim() ?? ""}`;
  const lastTarget = useRef(target);
  useEffect(() => {
    if (target === lastTarget.current) return;
    const timer = setTimeout(async () => {
      lastTarget.current = target;
      const next = await scoringContextAction(cv.id, dataRef.current).catch(() => null);
      if (next) setScoringContext(next);
    }, 800);
    return () => clearTimeout(timer);
  }, [cv.id, target]);

  // Premier message du coach. Gardé dans les données (sans les marquer modifiées) : la
  // sauvegarde automatique conserve ainsi le cache enregistré par le serveur.
  const opening = useCallback(async () => {
    const result = await coachOpeningAction(cv.id);
    if (!result.ok) return null;
    setData((d) => ({ ...d, coach: result.coach }));
    return result.coach.opening;
  }, [cv.id]);

  async function download() {
    setDownloading(true);
    try {
      const [{ pdf }, { CvDocument, registerCvFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./cv-document"),
      ]);
      registerCvFonts(window.location.origin);
      const blob = await pdf(<CvDocument data={data} templateId={templateId} title={title} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(title, data);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("[cv-builder] PDF", error);
      setSaveError("Le PDF n'a pas pu être généré. Réessaie dans un instant.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    // Plein écran : la page entière sur grand écran (score et chat à gauche, aperçu à droite).
    <div className="flex flex-col lg:h-dvh">
      {/* Barre du haut : retour, menu de l'application, titre, enregistrement, téléchargement. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/cv-builder"
          onClick={(e) => {
            if (!canLeave()) e.preventDefault();
          }}
          className="btn-secondary gap-1.5 px-3 py-1.5 text-sm"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retour
        </Link>
        <button type="button" onClick={openMenu} aria-haspopup="dialog" className="btn-secondary gap-1.5 px-3 py-1.5 text-sm">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
          Menu
        </button>
        <input
          aria-label="Nom du CV"
          value={title}
          maxLength={CV_LIMITS.title}
          onChange={(e) => {
            touched.current = true;
            setStatus("pending");
            setTitle(e.target.value);
          }}
          className="min-w-0 flex-1 basis-40 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold tracking-tight text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none dark:text-white dark:hover:border-slate-700"
        />
        <p
          role="status"
          className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
        >
          {SAVE_LABELS[status]}
        </p>
        <button type="button" onClick={download} disabled={downloading} className="btn-primary px-4 py-2 text-sm">
          {downloading ? "Génération du PDF…" : "Télécharger en PDF"}
        </button>
      </div>
      {saveError && (
        <p role="alert" className="mx-3 mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 sm:mx-4 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30">
          {saveError}
        </p>
      )}

      <div className="grid flex-1 gap-4 p-3 sm:p-4 lg:min-h-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Score (toujours visible, défilement propre), puis chat « coach » qui remplit la hauteur. */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
          <div className="shrink-0 lg:max-h-[40%] lg:overflow-y-auto">
            <CvScorePanel score={score} banned={banned} />
          </div>
          <RefineChat
            document="cvBuilder"
            applicationId={cv.id}
            aiEnabled={usage.aiEnabled}
            usage={usage.chat}
            resetLabel={usage.resetLabel}
            refine={refineBuilderCvAction}
            readDocument={() => JSON.stringify(chatContent(dataRef.current))}
            replaceDocument={(json) => {
              const current = dataRef.current;
              const previous = JSON.stringify(chatContent(current));
              try {
                const parsed = JSON.parse(json);
                const next = CvDataSchema.safeParse({
                  ...parsed,
                  personal: { ...parsed.personal, photo: current.personal.photo },
                  style: current.style,
                  analysis: current.analysis,
                  coach: current.coach,
                });
                if (next.success) edit(() => next.data);
              } catch {
                // Contenu illisible : le CV reste tel quel.
              }
              return previous;
            }}
            onPendingChange={() => {}}
            opening={opening}
            limitMessage={CVB_CHAT_LIMIT_MESSAGE}
            limitBlocks={false}
            undoable={false}
            fill
          />
        </div>

        {/* Aperçu : toute la hauteur disponible sur grand écran. */}
        <section aria-label="Aperçu du CV" className="card flex h-[80vh] flex-col overflow-hidden lg:h-auto lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 text-xs dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">Clique sur un texte de l&apos;aperçu pour le modifier.</p>
            <p className={pages > 1 ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>
              {pages > 1 ? `Environ ${pages} pages` : "1 page"}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4 dark:bg-slate-800/60">
            <CvHtmlPreview
              data={data}
              templateId={templateId}
              onEdit={(path, value) => edit((d) => applyEdit(d, path, value))}
              onPagesChange={setPages}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
