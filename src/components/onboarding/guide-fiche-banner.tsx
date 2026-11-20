"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { guideBannerSeenAction } from "@/app/actions/onboarding";
import { LumeoAvatar } from "@/components/lumeo/lumeo-avatar";
import { GUIDE_BANNER_TEXTS as T } from "@/lib/lumeo-texts";

/**
 * Bandeau de Lumeo sur la fiche de la candidature ajoutée pendant la phase guidée : sur le côté
 * (en haut à droite sur ordinateur, au-dessus du bouton rond de Lumeo ; carte en bas sur mobile,
 * où le bouton de Lumeo est dans la barre du haut). Non bloquant : rien n'est masqué ni piégé.
 * Noté « vu » dès qu'il s'affiche dans le navigateur ; un onglet fermé avant l'affichage le
 * laisse pour la prochaine ouverture de cette fiche.
 */
export function GuideFicheBanner({ applicationId, freeNote }: { applicationId: string; freeNote: string | null }) {
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void guideBannerSeenAction(applicationId).catch(() => undefined);
  }, [applicationId]);

  if (!open) return null;

  return (
    <aside
      aria-labelledby={titleId}
      className="ob-slide-in fixed inset-x-3 bottom-3 z-30 rounded-card border border-line bg-white p-4 sm:inset-x-auto sm:top-20 sm:right-6 sm:bottom-auto sm:w-[360px] sm:p-5 dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={T.close}
        className="ui-focus absolute top-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-pill hover:text-ink dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="ob-hop shrink-0">
          <LumeoAvatar size={56} expression="content" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.08em] text-[#2563EB] uppercase dark:text-blue-300">{T.label}</p>
          <h2 id={titleId} className="mt-1 text-[15px] leading-snug font-semibold text-ink dark:text-white">
            {T.title}
          </h2>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/cv-builder?applicationId=${applicationId}`} className="ui-btn-primary">
          {T.adapt}
        </Link>
        <Link href={`/candidatures/${applicationId}/lettre`} className="ui-btn-secondary">
          {T.letter}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ui-focus inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-2 hover:text-accent dark:text-white"
        >
          {T.later}
        </button>
        {freeNote && <p className="text-xs text-muted dark:text-slate-300">{freeNote}</p>}
      </div>
    </aside>
  );
}
