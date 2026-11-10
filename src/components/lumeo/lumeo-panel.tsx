"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { askLumeoAction } from "@/app/actions/lumeo";
import { RefineChat } from "@/components/application/refine-chat";
import { lumeoLocation, lumeoSuggestions, safeLumeoHref, showsLumeoButton } from "@/lib/lumeo-panel";
import { LUMEO_PANEL_TEXTS as T } from "@/lib/lumeo-texts";

import { LumeoAvatar } from "./lumeo-avatar";

const NO_USAGE = { used: 0, limit: null };
const noDocument = () => "";

/** Bouton d'ouverture : visible sur cette page ? ouvert ? et l'action d'ouverture. */
type LumeoTrigger = { visible: boolean; open: boolean; openPanel: (opener: HTMLElement) => void };
const LumeoContext = createContext<LumeoTrigger | null>(null);

/**
 * Lumeo dans tout l'espace connecté : un seul panneau (à droite, plein écran sur mobile) et une
 * seule conversation, gardée en mémoire tant que la page n'est pas rechargée (rien n'est
 * enregistré), qui sait sur quelle page est l'utilisateur. Deux boutons l'ouvrent : rond en bas à
 * droite sur ordinateur (≥ 1024 px), dans la barre du haut sur mobile (LumeoTopbarButton). Masqués
 * dans l'éditeur plein écran du CV Builder, qui a son propre onglet Lumeo.
 */
export function LumeoProvider({ aiEnabled, children }: { aiEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const location = lumeoLocation(pathname);
  const where = location.applicationId ? `${location.page}:${location.applicationId}` : location.page;
  const visible = showsLumeoButton(pathname);

  // Ouverture en fenêtre modale : focus piégé, Échap, fond inerte (dialog natif).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Lien suivi depuis une réponse (ou toute navigation) : le panneau se ferme sur la nouvelle page.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  const trigger: LumeoTrigger = {
    visible,
    open,
    openPanel: (opener) => {
      openerRef.current = opener;
      setOpen(true);
    },
  };

  return (
    <LumeoContext.Provider value={trigger}>
      {children}

      {/* Ordinateur : bouton rond en bas à droite. */}
      {visible && (
        <button
          type="button"
          data-lumeo-button
          aria-label={T.open}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => trigger.openPanel(e.currentTarget)}
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
          <div className="flex justify-end">
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
          <RefineChat
            document="lumeo"
            layout="panel"
            persona="lumeo"
            markdown
            undoable={false}
            limitBlocks={false}
            applicationId={where}
            aiEnabled={aiEnabled}
            usage={NO_USAGE}
            resetLabel=""
            refine={askLumeoAction}
            readDocument={noDocument}
            replaceDocument={noDocument}
            onPendingChange={() => {}}
            suggestions={lumeoSuggestions(location.page)}
            tagline={T.tagline}
            links={safeLumeoHref}
          />
        </div>
      </dialog>
    </LumeoContext.Provider>
  );
}

/**
 * Mobile (< 1024 px) : bouton Lumeo dans la barre du haut, à gauche du menu, cible de 44 px.
 * Rien hors de l'espace connecté (pas de fournisseur) ni dans l'éditeur du CV Builder.
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
