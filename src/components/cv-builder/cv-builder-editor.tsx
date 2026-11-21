"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  coachOpeningAction,
  refineBuilderCvAction,
  restoreCvLanguageAction,
  saveBuilderCvAction,
  scoringContextAction,
} from "@/app/actions/cv-builder";
import { MissingKeywordsPanel, MissingPointsPanel } from "@/components/application/missing-points-panel";
import { RefineChat, type ChatTurn, type RefineChatHandle } from "@/components/application/refine-chat";
import { LumeoAvatar } from "@/components/lumeo/lumeo-avatar";
import { finishGuideAction, guideReadyToDownloadAction, guideSavedAction } from "@/app/actions/onboarding";
import { GUIDE_TEXTS, LUMEO_TEXTS } from "@/lib/lumeo-texts";
import type { GuideEditorStep } from "@/lib/onboarding";
import { frenchSpaces, guideContentFingerprint, isCvImproved } from "@/lib/onboarding-guide";
import { useAppNav } from "@/components/app-nav-context";
import { CVB_CHAT_LIMIT_MESSAGE, type AiUsageCount } from "@/lib/ai-usage-limits";
import {
  applyEdit,
  chatContent,
  CvDataSchema,
  cvDataToText,
  cvOrigin,
  diffCvData,
  isLegacyTemplate,
  targetJobOf,
  withoutEmptyLines,
  withEditorFields,
  withoutPhoto,
  type BuilderCv,
  type CvData,
  type CvLang,
  type CvTemplateId,
} from "@/lib/cv-builder-types";
import { cvTitleLanguage } from "@/lib/cv-translation-language";
import { undoTranslationData } from "@/lib/cv-translation-guard";
import { photoSaveTracker } from "@/lib/cv-photo";
import { keywordKey, matchCvKeywords } from "@/lib/cv-keyword-match";
import { offerKeywordScore, offerKeywordsCapLine, offerKeywordsLine, offerScoreLabel, scoreCv, type ScoringContext } from "@/lib/cv-score";
import type { OfferKeyword } from "@/lib/cv-types";
import { mergeSkipped, readSkipped, type SkippedEntry } from "@/lib/skipped-points";
import { createClient } from "@/lib/supabase/client";

import { CvHtmlPreview } from "./cv-html-preview";
import { CvScorePanel } from "./cv-score-card";
import { CvContentPanel } from "./cv-content-panel";
import { CvTranslatePanel } from "./cv-translate-panel";
import { CvStylePanel } from "./cv-style-panel";
import { FieldEditingContext, FieldInput } from "./form-controls";
import { GuidedFooterStyle } from "@/components/onboarding/guided-footer-style";

import { GuidedHeader } from "./guided-header";

export type CvBuilderUsage = {
  /** Chat « Affiner avec l'IA » : utilisation du mois. */
  chat: AiUsageCount;
  /** Traductions du CV du mois (cvb_traduction). */
  translation: AiUsageCount;
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
  guided = null,
}: {
  /**
   * Phase guidée du parcours d'accueil (chemin A) : étape en cours, ou null (éditeur habituel).
   * En-tête guidé à la place de « Retour » et « Menu », « Passer » toujours disponible.
   */
  guided?: GuideEditorStep | null;
  cv: BuilderCv;
  usage: CvBuilderUsage;
  /** Données du secteur pour le score (détecté à l'ouverture). */
  scoring: ScoringContext;
  /** Ouvre l'onglet du coach d'abord, même pour un CV créé depuis zéro (lien ?onglet=chat). */
  openCoach?: boolean;
  /** Candidature liée : retour à sa fiche et mots-clés de son analyse (points d'une ancienne analyse). */
  application?: {
    id: string;
    /** « Poste — Entreprise », pour la confirmation de la traduction. */
    label: string;
    /** Langue de l'offre (null : indécidable), pour l'avertissement de la traduction. */
    offerLanguage: CvLang | null;
    keywords: { keywords: OfferKeyword[]; ignored: string[]; refused: string[] } | null;
    missingPoints: string[];
  } | null;
}) {
  const [title, setTitle] = useState(cv.title);
  // Modèle et couleur d'accent : panneau « Style du CV » (enregistrés avec le CV).
  const [templateId, setTemplateId] = useState<CvTemplateId>(cv.templateId);
  // Modèle à l'ouverture de l'éditeur, gardé ici : la sauvegarde automatique écrase celui de la base.
  // Ancien modèle : l'onglet Style le propose dès l'ouverture et pendant toute la session (« Ton modèle actuel »).
  const [originTemplate] = useState(cv.templateId);
  // CV créé depuis zéro : onglet « Contenu » en plus, ouvert d'abord (le CV est vide).
  const baseTabs = cvOrigin(cv.data) === "scratch" ? SCRATCH_TABS : IMPORT_TABS;
  // Phase guidée : Lumeo d'abord.
  const [chosenTab, setTab] = useState<TabId>(openCoach || guided ? "chat" : baseTabs[0][0]);
  // Phase guidée : étape en cours (null : terminée, passée, ou éditeur habituel).
  const [guideStep, setGuideStep] = useState<GuideEditorStep | null>(guided);
  const guideStepRef = useRef(guideStep);
  useEffect(() => {
    guideStepRef.current = guideStep;
  }, [guideStep]);
  // Contenu à l'ouverture : la première sauvegarde ne compte comme « amélioré » que s'il a changé.
  const guideBaseline = useRef(guideContentFingerprint(cv.data));
  const router = useRouter();
  const [data, setData] = useState<CvData>(cv.data);
  // Langue des titres des rubriques : celle du contenu quand elle est décidable, sinon la colonne
  // (fixée par une traduction ou un import), sinon le français.
  const [storedLanguage, setStoredLanguage] = useState<CvLang | null>(cv.language);
  const language: CvLang = cvTitleLanguage(data, storedLanguage);
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
  /** Dernière photo dont l'enregistrement est confirmé (sauvegarde automatique). */
  const photoTracker = useRef(photoSaveTracker(cv.data.personal.photo));
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

  // Sauvegarde automatique, une seconde après la dernière modification. La photo n'est envoyée
  // que si elle a changé depuis le dernier enregistrement confirmé (« unchanged » sinon). Avant une
  // traduction, la sauvegarde en attente est envoyée tout de suite et attendue (flushSave).
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSave = useRef<(() => Promise<boolean>) | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (!touched.current) return;
    const current = ++version.current;
    const save = async (): Promise<boolean> => {
      pendingSave.current = null;
      setStatus("saving");
      const shownPhoto = data.personal.photo;
      const photo = photoTracker.current.patch(shownPhoto);
      const sent = data.translationId ?? null;
      const request = saveBuilderCvAction(cv.id, { title, templateId, data: withoutPhoto(data), photo });
      inFlight.current = request.then(
        (r) => r.ok,
        () => false,
      );
      const result = await request;
      // Sauvegarde partie avant une traduction faite ici : refusée par le serveur, la traduction
      // (déjà affichée) l'a remplacée. Rien à signaler.
      if (!result.ok && result.stale && (dataRef.current.translationId ?? null) !== sent) return true;
      // Phase guidée : contenu enregistré différent de celui de l'ouverture → étape « télécharger ».
      if (result.ok && guideStepRef.current === "guide_cv" && isCvImproved(guideBaseline.current, data)) {
        guideStepRef.current = "guide_telecharger";
        setGuideStep("guide_telecharger");
        void guideReadyToDownloadAction(false).catch(() => undefined);
      }
      if (current !== version.current) return result.ok; // une modification plus récente suivra
      if (result.ok) {
        photoTracker.current.confirm(photo, result.photoRefused ? null : shownPhoto);
        // Photo refusée par le serveur : retirée de l'éditeur aussi (le message l'explique).
        if (result.photoRefused) setData((d) => (d.personal.photo === shownPhoto ? { ...d, personal: { ...d.personal, photo: null } } : d));
      }
      setStatus(result.ok ? "saved" : "error");
      setSaveError(result.ok ? (result.notice ?? null) : result.error);
      return result.ok;
    };
    pendingSave.current = save;
    saveTimer.current = setTimeout(save, 1000);
    return () => {
      clearTimeout(saveTimer.current);
      if (pendingSave.current === save) pendingSave.current = null;
    };
  }, [cv.id, title, templateId, data]);

  /**
   * Avant une traduction : sauvegarde en cours attendue, sauvegarde en attente envoyée tout de
   * suite. False : le CV affiché n'est pas enregistré (la traduction ne part pas).
   */
  async function flushSave(): Promise<boolean> {
    clearTimeout(saveTimer.current);
    const previous = inFlight.current;
    if (previous) await previous;
    const pending = pendingSave.current;
    if (pending) return pending();
    if (!inFlight.current) return true;
    return await inFlight.current;
  }

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

  // Candidature liée : mots-clés de l'offre comparés au CV affiché, onglet tant qu'il en manque ou
  // qu'un mot-clé est retiré. Refus relevés par le serveur dans le chat : mis à jour à chaque échange.
  const [refusedKeywords, setRefusedKeywords] = useState<string[]>(application?.keywords?.refused ?? []);
  const savedKeywords = application?.keywords;
  const offerKeywords = useMemo(
    () => (savedKeywords ? { ...savedKeywords, refused: refusedKeywords } : null),
    [savedKeywords, refusedKeywords],
  );
  const sector = scoringContext.sector;
  const keywordMatch = useMemo(
    () => (offerKeywords ? matchCvKeywords(offerKeywords, cvDataToText(data), sector) : null),
    [offerKeywords, data, sector],
  );
  const offerScore = useMemo(() => offerKeywordScore(data, scoringContext), [data, scoringContext]);
  const missingPoints = offerKeywords ? [] : (application?.missingPoints ?? []);
  const showKeywords =
    Boolean(keywordMatch?.rows.some((r) => !r.present && !r.ignored)) || missingPoints.length > 0;

  /** Refus enregistrés par le serveur : score et onglet recalculés tout de suite. */
  function applyRefused(list: string[]) {
    const refused = new Set(list.map(keywordKey));
    setRefusedKeywords(list);
    setScoringContext((ctx) =>
      ctx.offerKeywords
        ? { ...ctx, offerKeywords: ctx.offerKeywords.map((k) => ({ ...k, refused: refused.has(keywordKey(k.keyword)) })) }
        : ctx,
    );
  }
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
      const next = await scoringContextAction(cv.id, withoutPhoto(dataRef.current)).catch(() => null);
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
  const skipped = useRef<SkippedEntry[]>([]);
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
      skipped.current = readSkipped(row?.skipped_points);
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
    if (result.skippedPoints?.length) skipped.current = mergeSkipped(skipped.current, result.skippedPoints);
    if (result.refusedKeywords) applyRefused(result.refusedKeywords);
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
      const blob = await pdf(<CvDocument data={withoutEmptyLines(data)} templateId={templateId} title={title} language={language} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(title);
      link.click();
      // Le téléchargement ne fait jamais avancer la phase guidée.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("[cv-builder] PDF", error);
      setSaveError("Le PDF n'a pas pu être généré. Réessaie dans un instant.");
    } finally {
      setDownloading(false);
    }
  }

  // Phase guidée : « Passer » enregistre d'abord la modification en attente, puis termine le
  // parcours et mène au tableau de bord. Jamais désactivé (un second clic est simplement ignoré).
  const skipping = useRef(false);
  async function skipGuide() {
    if (skipping.current) return;
    skipping.current = true;
    const saved = await flushSave().catch(() => false);
    if (!saved && !window.confirm(LEAVE_MESSAGE)) {
      skipping.current = false;
      return;
    }
    await finishGuideAction(guideStepRef.current).catch(() => undefined);
    router.push("/dashboard");
  }

  // Phase guidée, étape 2 : « Enregistrer mon CV » enregistre d'abord la modification en attente.
  // Échec : message, on reste sur l'étape (« Passer » reste actif). Sinon : écran « Bravo ».
  const [guideSaving, setGuideSaving] = useState(false);
  async function saveGuide() {
    if (guideSaving) return;
    setGuideSaving(true);
    const saved = await flushSave().catch(() => false);
    if (!saved) {
      setSaveError(GUIDE_TEXTS.saveError);
      setGuideSaving(false);
      return;
    }
    await guideSavedAction().catch(() => undefined);
    router.push("/bienvenue?etape=bravo");
  }

  function alreadyGood() {
    guideStepRef.current = "guide_telecharger";
    setGuideStep("guide_telecharger");
    void guideReadyToDownloadAction(true).catch(() => undefined);
  }

  return (
    // Plein écran : la page entière sur grand écran (score et chat à gauche, aperçu à droite).
    <div className="flex flex-col lg:h-dvh">
      {guideStep && <GuidedHeader step={guideStep} onSkip={() => void skipGuide()} />}
      {guideStep && <GuidedFooterStyle />}
      {/* Barre du haut : retour, menu de l'application, titre, enregistrement, téléchargement. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
        {/* Phase guidée : ni « Retour » ni « Menu » (seule sortie : « Passer », dans l'en-tête guidé). */}
        {!guideStep && (
          <>
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
          </>
        )}
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
        {guideStep === "guide_telecharger" ? (
          // Étape 2 de la phase guidée : enregistrer (pas de PDF), halo qui pulse doucement.
          <button type="button" onClick={() => void saveGuide()} disabled={guideSaving} className="ob-halo ui-btn-primary px-5 py-2.5 text-[13px]">
            {guideSaving ? GUIDE_TEXTS.saving : GUIDE_TEXTS.save}
          </button>
        ) : (
          <button type="button" onClick={download} disabled={downloading} className="ui-btn-primary px-5 py-2.5 text-[13px]">
            {downloading ? "Génération du PDF…" : "Télécharger en PDF"}
          </button>
        )}
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
            <CvScorePanel score={score} offerLabel={offerScoreLabel(scoringContext)} />
          </div>
          {guideStep === "guide_telecharger" && (
            // Félicitations de Lumeo : le bouton de l'en-tête devient « Enregistrer mon CV ».
            <section aria-labelledby="guide-ready" className="ob-rise-1 flex shrink-0 items-start gap-3 rounded-block border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <span className="ob-hop shrink-0">
                <LumeoAvatar size={36} expression="felicite" celebrate />
              </span>
              <div className="min-w-0">
                <h2 id="guide-ready" className="text-sm font-semibold text-ink dark:text-white">
                  {/* Espace insécable devant « : » (typographie française). */}
                  {frenchSpaces(GUIDE_TEXTS.congrats)}
                </h2>
                <p className="mt-1 text-[13px] text-muted dark:text-slate-300">{GUIDE_TEXTS.congratsNote}</p>
                {/* Télécharge le PDF tout de suite, sans faire avancer le parcours. */}
                <button
                  type="button"
                  onClick={download}
                  disabled={downloading}
                  className="ui-focus mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-ink underline underline-offset-2 hover:text-accent disabled:opacity-60 dark:text-white"
                >
                  {downloading ? "Génération du PDF…" : GUIDE_TEXTS.downloadNow}
                </button>
              </div>
            </section>
          )}
          {guideStep === "guide_cv" && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-muted dark:text-slate-300">
              <p className="min-w-0">{GUIDE_TEXTS.note}</p>
              <button
                type="button"
                onClick={alreadyGood}
                className="ui-focus inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-accent dark:text-white"
              >
                {GUIDE_TEXTS.alreadyGood}
              </button>
            </div>
          )}
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
                    const next = CvDataSchema.safeParse(withEditorFields(parsed, current));
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
                {...(guideStep ? { suggestions: GUIDE_TEXTS.suggestions, placeholder: GUIDE_TEXTS.placeholder } : {})}
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
                <MissingKeywordsPanel match={keywordMatch} summary={offerScore && offerKeywordsLine(offerScore)} capNote={offerScore && offerKeywordsCapLine(offerScore)} onInsert={insertInChat} />
              ) : (
                <MissingPointsPanel points={missingPoints} onInsert={insertInChat} />
              )}
            </div>
          )}
          {tab === "style" && (
            <div id="panel-style" role="tabpanel" aria-labelledby="tab-style" className="ui-card p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <CvStylePanel
                data={data}
                language={language}
                templateId={templateId}
                accent={data.style.accent}
                settings={data.style}
                photo={data.personal.photo}
                origin={isLegacyTemplate(originTemplate) ? originTemplate : null}
                onTemplate={(id) => {
                  if (id === templateId) return;
                  touched.current = true;
                  setStatus("pending");
                  setTemplateId(id);
                }}
                onAccent={(accent) => edit((d) => ({ ...d, style: { ...d.style, accent } }))}
                onSettings={(patch) => edit((d) => ({ ...d, style: { ...d.style, ...patch } }))}
                onPhoto={(photo) => edit((d) => ({ ...d, personal: { ...d.personal, photo } }))}
              />
              <CvTranslatePanel
                cvId={cv.id}
                title={title}
                data={data}
                usage={usage.translation}
                resetLabel={usage.resetLabel}
                aiEnabled={usage.aiEnabled}
                application={application ? { label: application.label, offerLanguage: application.offerLanguage } : null}
                beforeTranslate={flushSave}
                onTranslated={(value) => {
                  // CV écrit par le serveur (sans la photo) : il remplace le contenu affiché.
                  setData((d) => ({ ...value.data, personal: { ...value.data.personal, photo: d.personal.photo } }));
                  setStoredLanguage(value.language);
                }}
                onUndo={(snapshot, previousLanguage) => {
                  // Contenu d'avant par la sauvegarde normale (identifiant de la traduction gardé).
                  edit((d) => undoTranslationData(snapshot, d));
                  setStoredLanguage(previousLanguage);
                  void restoreCvLanguageAction(cv.id, previousLanguage);
                }}
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
              language={language}
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
