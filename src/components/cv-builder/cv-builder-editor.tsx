"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  coachOpeningAction,
  refineBuilderCvAction,
  saveBuilderCvAction,
  scoringContextAction,
} from "@/app/actions/cv-builder";
import { MissingKeywordsPanel, MissingPointsPanel } from "@/components/application/missing-points-panel";
import { RefineChat, type ChatTurn, type RefineChatHandle } from "@/components/application/refine-chat";
import { LUMEO_TEXTS } from "@/lib/lumeo-texts";
import { useAppNav } from "@/components/app-nav-context";
import { CVB_CHAT_LIMIT_MESSAGE, type AiUsageCount } from "@/lib/ai-usage-limits";
import {
  applyEdit,
  chatContent,
  CvDataSchema,
  cvDataToText,
  cvOrigin,
  diffCvData,
  targetJobOf,
  withoutEmptyLines,
  type BuilderCv,
  type CvData,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { matchCvKeywords } from "@/lib/cv-keyword-match";
import { scoreCv, type ScoringContext } from "@/lib/cv-score";
import type { OfferKeyword } from "@/lib/cv-types";
import { createClient } from "@/lib/supabase/client";

import { CvHtmlPreview } from "./cv-html-preview";
import { CvScorePanel } from "./cv-score-card";
import { CvContentPanel } from "./cv-content-panel";
import { CvStylePanel } from "./cv-style-panel";
import { FieldEditingContext, FieldInput } from "./form-controls";

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

/** Démarrage du coach d'un clic, pour un CV créé depuis zéro. */
const COACH_STARTER = { label: "Améliorer mon CV point par point", message: "Aide-moi à améliorer mon CV point par point" };

/** Surlignage des textes modifiés par le coach : début du fondu, puis fin (fondu CSS de 1,5 s). */
const HIGHLIGHT_FADE_MS = 2000;
const HIGHLIGHT_END_MS = 3500;

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** Messages du coach gardés en base (les plus récents), chacun coupé comme côté serveur. */
const HISTORY_MAX = 60;
const MESSAGE_MAX_LENGTH = 2000;

/** Échanges lus (base ou historique du chat) : seuls les messages valides, bornés. */
function readTurns(value: unknown): ChatTurn[] {
  return Array.isArray(value)
    ? value
        .filter(
          (t): t is ChatTurn =>
            Boolean(t) && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim() !== "",
        )
        .slice(-HISTORY_MAX)
        .map(({ role, content }) => ({ role, content: content.slice(0, MESSAGE_MAX_LENGTH) }))
    : [];
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

type TabId = "content" | "chat" | "style" | "keywords";
const SCRATCH_TABS: [TabId, string][] = [
  ["content", "Contenu"],
  ["chat", LUMEO_TEXTS.name],
  ["style", "Style du CV"],
];
const IMPORT_TABS: [TabId, string][] = [
  ["chat", LUMEO_TEXTS.name],
  ["style", "Style du CV"],
];

/** Nom du PDF : le nom du CV, sans les caractères interdits dans un nom de fichier. */
function fileName(title: string) {
  const base = title.replace(/[\\/:*?"<>|]/g, "-").replace(/[. ]+$/, "").trim();
  return `${base || "CV"}.pdf`;
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
  openCoach = false,
  application = null,
}: {
  cv: BuilderCv;
  usage: CvBuilderUsage;
  /** Données du secteur pour le score (détecté à l'ouverture). */
  scoring: ScoringContext;
  /** Ouvre l'onglet du coach d'abord, même pour un CV créé depuis zéro (lien ?onglet=chat). */
  openCoach?: boolean;
  /** Candidature liée : retour à sa fiche et mots-clés de son analyse (points d'une ancienne analyse). */
  application?: {
    id: string;
    keywords: { keywords: OfferKeyword[]; ignored: string[] } | null;
    missingPoints: string[];
  } | null;
}) {
  const [title, setTitle] = useState(cv.title);
  // Modèle et couleur d'accent : panneau « Style du CV » (enregistrés avec le CV).
  const [templateId, setTemplateId] = useState<CvTemplateId>(cv.templateId);
  // CV créé depuis zéro : onglet « Contenu » en plus, ouvert d'abord (le CV est vide).
  const baseTabs = cvOrigin(cv.data) === "scratch" ? SCRATCH_TABS : IMPORT_TABS;
  const [chosenTab, setTab] = useState<TabId>(openCoach ? "chat" : baseTabs[0][0]);
  const [data, setData] = useState<CvData>(cv.data);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pages, setPages] = useState(1);
  // Saisie bloquée (limite d'un champ, liste pleine) : message affiché quelques secondes.
  const [lineLimit, setLineLimit] = useState<string | null>(null);
  const lineLimitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showLineLimit = useCallback((message: string) => {
    setLineLimit(message);
    clearTimeout(lineLimitTimer.current);
    lineLimitTimer.current = setTimeout(() => setLineLimit(null), 4000);
  }, []);
  const titleEditing = useMemo(() => ({ notify: showLineLimit }), [showLineLimit]);
  useEffect(() => () => clearTimeout(lineLimitTimer.current), []);
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

  // Textes modifiés par le coach, surlignés quelques secondes dans l'aperçu (jamais dans le PDF).
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [highlightFading, setHighlightFading] = useState(false);
  const highlightTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearHighlightTimers = () => highlightTimers.current.forEach(clearTimeout);
  useEffect(() => clearHighlightTimers, []);

  const showHighlights = (paths: string[]) => {
    if (!paths.length) return;
    // Réponse suivante avant la fin du surlignage : ses délais remplacent les précédents.
    clearHighlightTimers();
    setHighlights(new Set(paths));
    setHighlightFading(false);
    highlightTimers.current = [
      setTimeout(() => setHighlightFading(true), HIGHLIGHT_FADE_MS),
      setTimeout(() => {
        setHighlights(new Set());
        setHighlightFading(false);
      }, HIGHLIGHT_END_MS),
    ];
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
      setSaveError(result.ok ? (result.notice ?? null) : result.error);
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

  // Candidature liée : mots-clés de l'offre comparés au CV affiché, onglet tant qu'il en manque.
  const offerKeywords = application?.keywords;
  const sector = scoringContext.sector;
  const keywordMatch = useMemo(
    () => (offerKeywords ? matchCvKeywords(offerKeywords, cvDataToText(data), sector) : null),
    [offerKeywords, data, sector],
  );
  const missingPoints = offerKeywords ? [] : (application?.missingPoints ?? []);
  const showKeywords = Boolean(keywordMatch?.rows.some((r) => !r.present && !r.ignored)) || missingPoints.length > 0;
  const tabs: [TabId, string][] = showKeywords ? [...baseTabs, ["keywords", "Mots-clés"]] : baseTabs;
  // Dernier mot-clé ajouté au CV depuis l'aperçu : l'onglet disparaît, retour au chat.
  const tab = chosenTab === "keywords" && !showKeywords ? "chat" : chosenTab;
  const chatRef = useRef<RefineChatHandle>(null);

  // Poste cible modifié (titre du CV ou poste visé) : secteur redétecté par le serveur.
  const target = `${data.personal.jobTitle.trim()}|${targetJobOf(data)}`;
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

  // Conversation avec le coach et points qu'il a abandonnés (le candidat ne sait pas ou ne veut
  // pas répondre), enregistrés dans cv_coach_history (migration 0033) pour être repris à la
  // prochaine ouverture. null : lecture en cours (le chat s'affiche une fois l'historique lu).
  const [coachHistory, setCoachHistory] = useState<ChatTurn[] | null>(SUPABASE_CONFIGURED ? null : []);
  const skipped = useRef<string[]>([]);
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    let cancelled = false;
    void (async () => {
      const { data: row, error } = await createClient()
        .from("cv_coach_history")
        .select("messages, skipped_points")
        .eq("cv_id", cv.id)
        .maybeSingle();
      // Sans historique (ou table pas encore créée) : la conversation démarre vide.
      if (error) console.error("[cv-builder] historique du coach : lecture", error.message);
      if (cancelled) return;
      skipped.current = readStrings(row?.skipped_points);
      setCoachHistory(readTurns(row?.messages));
    })();
    return () => {
      cancelled = true;
    };
  }, [cv.id]);

  // Clic sur un mot-clé : le chat s'affiche d'abord (le champ masqué ne peut pas prendre le focus),
  // puis reçoit le message. Pas de chat tant que l'historique n'est pas lu.
  const insertInChat =
    usage.aiEnabled && coachHistory !== null
      ? (text: string) => {
          flushSync(() => setTab("chat"));
          chatRef.current?.insert(text);
        }
      : undefined;

  // Échange du coach : points abandonnés renvoyés, puis conversation enregistrée (sans échec :
  // une sauvegarde manquée est seulement journalisée).
  async function refineWithHistory(id: string, json: string, message: string, history: unknown) {
    const result = await refineBuilderCvAction(id, json, message, history, skipped.current);
    if (!result.ok) return result;
    if (result.skippedPoints?.length) skipped.current = [...new Set([...skipped.current, ...result.skippedPoints])];
    if (SUPABASE_CONFIGURED) {
      const turns: ChatTurn[] = [
        ...readTurns(history),
        { role: "user", content: message },
        ...(result.limitNotice ? [{ role: "assistant" as const, content: result.limitNotice }] : []),
        { role: "assistant", content: result.reply },
      ];
      const { error } = await createClient()
        .from("cv_coach_history")
        .upsert({
          cv_id: id,
          messages: turns.slice(-HISTORY_MAX),
          skipped_points: skipped.current,
          updated_at: new Date().toISOString(),
        });
      if (error) console.error("[cv-builder] historique du coach : enregistrement", error.message);
    }
    return result;
  }

  async function download() {
    setDownloading(true);
    try {
      const [{ pdf }, { CvDocument, registerCvFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./cv-document"),
      ]);
      registerCvFonts(window.location.origin);
      const blob = await pdf(<CvDocument data={withoutEmptyLines(data)} templateId={templateId} title={title} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(title);
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
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={application ? `/candidatures/${application.id}` : "/cv-builder"}
          onClick={(e) => {
            if (!canLeave()) e.preventDefault();
          }}
          className="ui-btn-secondary gap-1.5 px-4 py-2 text-[13px]"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retour
        </Link>
        <button type="button" onClick={openMenu} aria-haspopup="dialog" className="ui-btn-secondary gap-1.5 px-4 py-2 text-[13px]">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
          Menu
        </button>
        <FieldEditingContext value={titleEditing}>
          <FieldInput
            aria-label="Nom du CV"
            path="title"
            value={title}
            onChange={(value) => {
              touched.current = true;
              setStatus("pending");
              setTitle(value);
            }}
            className="min-h-11 min-w-0 flex-1 basis-40 rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-bold tracking-title text-ink hover:border-line focus:border-accent focus:outline-none lg:min-h-0 dark:text-white dark:hover:border-slate-700"
          />
        </FieldEditingContext>
        <p
          role="status"
          className={`text-[13px] ${status === "error" ? "text-red-600 dark:text-red-400" : "text-muted dark:text-slate-400"}`}
        >
          {SAVE_LABELS[status]}
        </p>
        <button type="button" onClick={download} disabled={downloading} className="ui-btn-primary px-5 py-2.5 text-[13px]">
          {downloading ? "Génération du PDF…" : "Télécharger en PDF"}
        </button>
      </div>
      {saveError && (
        <p role="alert" className="ui-notice-error mx-3 mt-3 px-4 py-3 text-sm sm:mx-4">
          {saveError}
        </p>
      )}

      <div className="grid flex-1 gap-4 p-3 sm:p-4 lg:min-h-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Score (toujours visible), onglets, puis chat « coach » ou style, qui remplissent le reste de la hauteur. */}
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
          <div className="shrink-0">
            <CvScorePanel score={score} />
          </div>
          <div role="tablist" aria-label="Panneau de l'éditeur" className="flex shrink-0 flex-wrap gap-1.5">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={`ui-focus ui-hit relative rounded-full px-3.5 py-2 text-[13px] leading-[18px] whitespace-nowrap transition-colors ${
                  tab === id
                    ? "bg-ink font-semibold text-white dark:bg-white dark:text-slate-900"
                    : "bg-box font-medium text-prose hover:bg-[#E9E9EB] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Chat masqué (pas démonté) pendant l'onglet Style : la conversation en cours est gardée. */}
          <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={tab === "chat" ? "contents" : "hidden"}>
            {coachHistory === null ? (
              <p role="status" className="ui-card p-5 text-sm text-muted dark:text-slate-400">
                Chargement de la conversation…
              </p>
            ) : (
              <RefineChat
                document="cvBuilder"
                applicationId={cv.id}
                aiEnabled={usage.aiEnabled}
                usage={usage.chat}
                resetLabel={usage.resetLabel}
                refine={refineWithHistory}
                initialMessages={coachHistory}
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
                      targetJob: current.targetJob,
                      origin: current.origin,
                      coach: current.coach,
                    });
                    if (next.success) {
                      edit(() => next.data);
                      showHighlights(diffCvData(current, next.data));
                    }
                  } catch {
                    // Contenu illisible : le CV reste tel quel.
                  }
                  return previous;
                }}
                onPendingChange={() => {}}
                controlRef={chatRef}
                // Conversation reprise : pas de nouveau premier message.
                opening={coachHistory.length ? undefined : opening}
                starter={cvOrigin(data) === "scratch" ? COACH_STARTER : undefined}
                limitMessage={CVB_CHAT_LIMIT_MESSAGE}
                limitBlocks={false}
                undoable={false}
                fill
                minimal
                markdown
                persona="lumeo"
              />
            )}
          </div>
          {tab === "content" && (
            <div id="panel-content" role="tabpanel" aria-labelledby="tab-content" className="ui-card p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <CvContentPanel data={data} onChange={edit} onLimit={showLineLimit} />
            </div>
          )}
          {tab === "keywords" && (
            <div id="panel-keywords" role="tabpanel" aria-labelledby="tab-keywords" className="ui-card p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {keywordMatch ? (
                <MissingKeywordsPanel match={keywordMatch} onInsert={insertInChat} />
              ) : (
                <MissingPointsPanel points={missingPoints} onInsert={insertInChat} />
              )}
            </div>
          )}
          {tab === "style" && (
            <div id="panel-style" role="tabpanel" aria-labelledby="tab-style" className="ui-card p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <CvStylePanel
                templateId={templateId}
                accent={data.style.accent}
                onTemplate={(id) => {
                  if (id === templateId) return;
                  touched.current = true;
                  setStatus("pending");
                  setTemplateId(id);
                }}
                onAccent={(accent) => edit((d) => ({ ...d, style: { ...d.style, accent } }))}
              />
            </div>
          )}
        </div>

        {/* Aperçu : toute la hauteur disponible sur grand écran. */}
        <section aria-label="Aperçu du CV" className="ui-card flex h-[80vh] flex-col overflow-hidden lg:h-auto lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3 text-xs dark:border-slate-700">
            <p role="status" className={lineLimit ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted dark:text-slate-400"}>
              {lineLimit ?? "Clique sur un texte de l'aperçu pour le modifier."}
            </p>
            <p className={pages > 1 ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted dark:text-slate-400"}>
              {pages > 1 ? `Environ ${pages} pages` : "1 page"}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-b-card bg-[#F7F7F8] p-4 dark:bg-slate-800/60">
            <CvHtmlPreview
              data={data}
              templateId={templateId}
              onEdit={(path, value) => edit((d) => applyEdit(d, path, value))}
              onChange={edit}
              onLineLimit={showLineLimit}
              onPagesChange={setPages}
              highlights={highlights}
              highlightFading={highlightFading}
            />
          </div>
        </section>
      </div>
      {lineLimit && (
        <p aria-hidden="true" className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-sm font-medium text-amber-900 lg:hidden dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100">
          {lineLimit}
        </p>
      )}
    </div>
  );
}
