"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  coachOpeningAction,
  refineBuilderCvAction,
  saveBuilderCvAction,
  scoringContextAction,
} from "@/app/actions/cv-builder";
import { RefineChat, type RefineChatHandle } from "@/components/application/refine-chat";
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
import { scoreCv, type ScoringContext } from "@/lib/cv-score";

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
  initialRequest,
}: {
  cv: BuilderCv;
  usage: CvBuilderUsage;
  /** Données du secteur pour le score (détecté à l'ouverture). */
  scoring: ScoringContext;
  /** Demande envoyée au coach à l'ouverture (optimisation choisie à l'import). */
  initialRequest?: string;
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

  // Quitter la page avec des modifications non enregistrées : confirmation du navigateur.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // Score calculé par le code (cv-score.ts), recalculé à chaque modification du CV.
  const [scoringContext, setScoringContext] = useState(scoring);
  const score = useMemo(() => scoreCv(data, scoringContext), [data, scoringContext]);
  const chatRef = useRef<RefineChatHandle>(null);

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

  // Demande reçue à l'ouverture (?demande=) : retirée de l'adresse, pour ne pas la renvoyer
  // au rechargement de la page.
  useEffect(() => {
    if (initialRequest) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [initialRequest]);

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
    <div className="space-y-5">
      {/* Barre du haut : titre, état de l'enregistrement, téléchargement. */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/cv-builder" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          Mes CV
        </Link>
        <input
          aria-label="Nom du CV"
          value={title}
          maxLength={CV_LIMITS.title}
          onChange={(e) => {
            touched.current = true;
            setStatus("pending");
            setTitle(e.target.value);
          }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none dark:text-white dark:hover:border-slate-700 sm:text-2xl"
        />
        <p
          role="status"
          className={`text-sm ${status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
        >
          {SAVE_LABELS[status]}
        </p>
        <button type="button" onClick={download} disabled={downloading} className="btn-primary px-4 py-2.5 text-sm">
          {downloading ? "Génération du PDF…" : "Télécharger en PDF"}
        </button>
      </div>
      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30">
          {saveError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        {/* Score, puis chat « coach » : même composant que le chat de l'éditeur du CV d'une candidature. */}
        <div className="min-w-0 space-y-4">
          <CvScorePanel score={score} onPick={(request) => chatRef.current?.send(request)} />
          <RefineChat
            controlRef={chatRef}
            initialPrompt={initialRequest}
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
            tall
          />
        </div>

        {/* Aperçu : reste visible pendant la conversation (grand écran). */}
        <section
          aria-label="Aperçu du CV"
          className="card flex h-[80vh] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]"
        >
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
