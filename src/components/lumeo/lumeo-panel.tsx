"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { askLumeoAction } from "@/app/actions/lumeo";
import { RefineChat } from "@/components/application/refine-chat";
import { lumeoLocation, lumeoSuggestions, safeLumeoHref, showsLumeoButton } from "@/lib/lumeo-panel";
import { LUMEO_PANEL_TEXTS as T } from "@/lib/lumeo-texts";

import { LumeoAvatar } from "./lumeo-avatar";

const NO_USAGE = { used: 0, limit: null };
const noDocument = () => "";

/**
 * Lumeo dans tout l'espace connecté : bouton rond en bas à droite, panneau à droite (plein écran
 * sur mobile). Une seule conversation, gardée en mémoire tant que la page n'est pas rechargée
 * (rien n'est enregistré), qui sait sur quelle page est l'utilisateur. Masqué dans l'éditeur plein
 * écran du CV Builder, qui a son propre onglet Lumeo.
 */
export function LumeoPanel({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  return (
    <>
      {/* Panneau toujours monté (la conversation survit à l'éditeur) ; seul le bouton disparaît. */}
      {visible && (
      <button
        ref={buttonRef}
        type="button"
        data-lumeo-button
        aria-label={T.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="ui-focus fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex size-13 items-center justify-center rounded-full bg-[#0A0A0A] print:hidden dark:ring-1 dark:ring-slate-600"
      >
        <LumeoAvatar size={36} expression="neutre" inverse />
      </button>
      )}

      <dialog
        ref={dialogRef}
        aria-label={T.dialog}
        onClose={() => {
          setOpen(false);
          // Focus rendu au bouton (en plus du comportement natif, inégal selon les navigateurs).
          buttonRef.current?.focus();
        }}
        onClick={(e) => {
          // Clic sur le fond assombri (ordinateur) : fermeture.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-auto max-w-none border-0 bg-white p-0 text-ink backdrop:bg-slate-900/30 sm:left-auto sm:w-[400px] sm:border-l sm:border-line motion-safe:open:transition-[translate,opacity] motion-safe:open:duration-200 motion-safe:starting:open:translate-x-6 motion-safe:starting:open:opacity-0dark:bg-slate-950 dark:text-slate-100 dark:sm:border-slate-800"
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
    </>
  );
}
