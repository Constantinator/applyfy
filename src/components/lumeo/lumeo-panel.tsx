"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { askLumeoAction } from "@/app/actions/lumeo";
import { RefineChat, type ChatMessage, type ChatStore } from "@/components/application/refine-chat";
import {
  LUMEO_PAGE_PATH,
  isLumeoPage,
  lumeoLocation,
  lumeoReturnPath,
  lumeoSuggestions,
  safeLumeoHref,
  showsLumeoButton,
} from "@/lib/lumeo-panel";
import { LUMEO_PANEL_TEXTS as T } from "@/lib/lumeo-texts";

import { LumeoAvatar } from "./lumeo-avatar";

const NO_USAGE = { used: 0, limit: null };
const noDocument = () => "";
const noop = () => {};

/** Lumeo partagé par le panneau, la page /lumeo et les boutons d'ouverture. */
type LumeoState = {
  aiEnabled: boolean;
  /** Bouton d'ouverture visible sur cette page ? */
  visible: boolean;
  open: boolean;
  openPanel: (opener: HTMLElement) => void;
  /** Emplacement envoyé avec chaque question (sur /lumeo : la page d'où Lumeo a été agrandi). */
  where: string;
  suggestions: readonly string[];
  store: ChatStore;
  /** Page /lumeo → page précédente, panneau rouvert. */
  reduce: () => void;
};
const LumeoContext = createContext<LumeoState | null>(null);

/**
 * Lumeo dans tout l'espace connecté : un panneau (à droite, plein écran sur mobile) et une page
 * /lumeo qui affichent la même conversation, gardée en mémoire tant que la page n'est pas
 * rechargée (rien n'est enregistré), et qui sait sur quelle page est l'utilisateur. Deux boutons
 * ouvrent le panneau : rond en bas à droite sur ordinateur (≥ 1024 px), dans la barre du haut sur
 * mobile (LumeoTopbarButton). Masqués dans l'éditeur plein écran du CV Builder et sur /lumeo.
 */
export function LumeoProvider({ aiEnabled, children }: { aiEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  // Conversation partagée par le panneau et la page /lumeo (mémoire seulement).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const idRef = useRef(0);
  const store: ChatStore = { messages, setMessages, pending, setPending, nextId: () => idRef.current++ };

  // Dernière page hors de /lumeo : contexte des questions posées en pleine page, retour de « Réduire ».
  const [lastPath, setLastPath] = useState<string | null>(isLumeoPage(pathname) ? null : pathname);
  // « Réduire » : le panneau se rouvre à l'arrivée sur la page précédente.
  const [reopen, setReopen] = useState(false);

  const location = lumeoLocation(isLumeoPage(pathname) ? (lastPath ?? pathname) : pathname);
  const where = location.applicationId ? `${location.page}:${location.applicationId}` : location.page;
  const visible = showsLumeoButton(pathname);

  // Ouverture en fenêtre modale : focus piégé, Échap, fond inerte (dialog natif).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Navigation (lien d'une réponse, « Agrandir »…) : le panneau se ferme sur la nouvelle page,
  // sauf au retour de « Réduire », où il se rouvre.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    if (!isLumeoPage(pathname)) setLastPath(pathname);
    setOpen(reopen);
    setReopen(false);
  }

  const state: LumeoState = {
    aiEnabled,
    visible,
    open,
    openPanel: (opener) => {
      openerRef.current = opener;
      setOpen(true);
    },
    where,
    suggestions: lumeoSuggestions(location.page),
    store,
    reduce: () => {
      openerRef.current = null;
      setReopen(true);
      router.push(lumeoReturnPath(lastPath));
    },
  };

  return (
    <LumeoContext.Provider value={state}>
      {children}

      {/* Ordinateur : bouton rond en bas à droite. */}
      {visible && (
        <button
          type="button"
          data-lumeo-button
          aria-label={T.open}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => state.openPanel(e.currentTarget)}
          className="ui-focus fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 hidden size-13 items-center justify-center rounded-full bg-[#0A0A0A] lg:flex print:hidden dark:ring-1 dark:ring-slate-600"
        >
          <LumeoAvatar size={36} expression="neutre" inverse />
        </button>
      )}

      {/* Panneau toujours monté (la conversation survit à l'éditeur) ; seuls les boutons disparaissent. */}
      <dialog
        ref={dialogRef}
        aria-label={T.dialog}
        onClose={() => {
          setOpen(false);
          // Focus rendu au bouton qui a ouvert le panneau (en plus du comportement natif).
          openerRef.current?.focus();
        }}
        onClick={(e) => {
          // Clic sur le fond assombri (ordinateur) : fermeture.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-auto max-w-none border-0 bg-white p-0 text-ink backdrop:bg-slate-900/30 sm:left-auto sm:w-[400px] sm:border-l sm:border-line motion-safe:open:transition-[translate,opacity] motion-safe:open:duration-200 motion-safe:starting:open:translate-x-6 motion-safe:starting:open:opacity-0 dark:bg-slate-950 dark:text-slate-100 dark:sm:border-slate-800"
      >
        <div className="flex h-full flex-col gap-3 pt-[max(12px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[max(16px,env(safe-area-inset-bottom))] pl-[max(16px,env(safe-area-inset-left))]">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => router.push(LUMEO_PAGE_PATH)}
              aria-label={T.expandLabel}
              className="ui-focus flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {T.expand}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={T.close}
              className="ui-focus flex size-11 items-center justify-center rounded-full text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <LumeoChat state={state} layout="panel" />
        </div>
      </dialog>
    </LumeoContext.Provider>
  );
}

/** Conversation de Lumeo (panneau ou page), branchée sur l'état partagé. */
function LumeoChat({ state, layout }: { state: LumeoState; layout: "panel" | "page" }) {
  return (
    <RefineChat
      document="lumeo"
      layout={layout}
      persona="lumeo"
      markdown
      undoable={false}
      limitBlocks={false}
      applicationId={state.where}
      aiEnabled={state.aiEnabled}
      usage={NO_USAGE}
      resetLabel=""
      refine={askLumeoAction}
      readDocument={noDocument}
      replaceDocument={noDocument}
      onPendingChange={noop}
      suggestions={state.suggestions}
      tagline={T.tagline}
      links={safeLumeoHref}
      store={state.store}
    />
  );
}

/**
 * Mobile (< 1024 px) : bouton Lumeo dans la barre du haut, à gauche du menu, cible de 44 px.
 * Rien hors de l'espace connecté (pas de fournisseur), dans l'éditeur du CV Builder ni sur /lumeo.
 */
export function LumeoTopbarButton() {
  const lumeo = useContext(LumeoContext);
  if (!lumeo?.visible) return null;
  return (
    <button
      type="button"
      aria-label={T.open}
      aria-haspopup="dialog"
      aria-expanded={lumeo.open}
      onClick={(e) => lumeo.openPanel(e.currentTarget)}
      className="ui-focus flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] lg:hidden dark:ring-1 dark:ring-slate-600"
    >
      <LumeoAvatar size={36} expression="neutre" inverse />
    </button>
  );
}

/**
 * Page /lumeo : la même conversation que le panneau, en colonne de lecture (720 px au plus),
 * zone de saisie fixée en bas, bouton « Réduire » pour revenir au panneau.
 */
export function LumeoFullPage() {
  const lumeo = useContext(LumeoContext);
  if (!lumeo) return null;
  return (
    <main className="mx-auto flex h-[calc(100dvh-68px)] w-full max-w-[720px] flex-col gap-3 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-6">
      <h1 className="sr-only">{T.nav}</h1>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={lumeo.reduce}
          aria-label={T.reduceLabel}
          className="ui-focus flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {T.reduce}
        </button>
      </div>
      <LumeoChat state={lumeo} layout="page" />
    </main>
  );
}
