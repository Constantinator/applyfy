"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { refineBuilderCvAction, saveBuilderCvAction } from "@/app/actions/cv-builder";
import { RefineChat } from "@/components/application/refine-chat";
import { CVB_CHAT_LIMIT_MESSAGE, type AiUsageCount } from "@/lib/ai-usage-limits";
import {
  applyEdit,
  chatContent,
  CV_LIMITS,
  CvDataSchema,
  CV_TEMPLATES,
  fullName,
  type BuilderCv,
  type CvAnalysis,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";

import { CvHtmlPreview } from "./cv-html-preview";

export type CvBuilderUsage = {
  /** Chat « Affiner avec l'IA » : utilisation du mois. */
  chat: AiUsageCount;
  resetLabel: string;
  /** Clé API Claude configurée. */
  aiEnabled: boolean;
};

/** Couleur de la pastille de chaque modèle dans le sélecteur. */
const TEMPLATE_SWATCH: Record<CvTemplateId, string> = {
  minimaliste: "bg-white ring-1 ring-slate-400",
  classique: "bg-slate-700",
  moderne: "bg-[#1E40AF]",
  sidebar: "bg-[#1E293B]",
  tech: "bg-[#059669]",
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

/** Premier message du chat d'un CV importé : les optimisations prioritaires de l'analyse. */
function welcomeMessage(analysis: CvAnalysis) {
  const points = analysis.optimizations.map((o) => `• ${o.title}`);
  return [
    points.length ? `Voici ce que j'ai identifié à améliorer dans ton CV :\n${points.join("\n")}` : null,
    analysis.targetJob ? `Je tiens compte du poste que tu vises : ${analysis.targetJob}.` : null,
    "Tu peux me demander de corriger l'un de ces points, ou me poser n'importe quelle question sur ton CV.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Éditeur du CV Builder : chat « Affiner avec l'IA » à gauche (40 %) et aperçu du CV à
 * droite (60 %), modifiable d'un clic sur un texte. CV importé : le chat s'ouvre sur les
 * points à améliorer de l'analyse.
 */
export function CvBuilderEditor({ cv, usage }: { cv: BuilderCv; usage: CvBuilderUsage }) {
  const [title, setTitle] = useState(cv.title);
  const [templateId, setTemplateId] = useState<CvTemplateId>(cv.templateId);
  const [data, setData] = useState<CvData>(cv.data);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pages, setPages] = useState(1);
  const analysis = cv.data.analysis;
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

      {/* Choix du modèle : les données sont communes aux 5 modèles. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Modèle</legend>
        <div className="flex flex-wrap gap-2">
          {CV_TEMPLATES.map((t) => {
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                title={t.description}
                onClick={() => {
                  touched.current = true;
                  setStatus("pending");
                  setTemplateId(t.id);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${TEMPLATE_SWATCH[t.id]}`} />
                {t.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        {/* Chat « Affiner avec l'IA » : même composant que l'éditeur du CV d'une candidature. */}
        <div className="min-w-0">
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
                });
                if (next.success) edit(() => next.data);
              } catch {
                // Contenu illisible : le CV reste tel quel.
              }
              return previous;
            }}
            onPendingChange={() => {}}
            welcome={analysis ? welcomeMessage(analysis) : undefined}
            suggestions={analysis?.optimizations.map((o) => o.request).filter(Boolean)}
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
