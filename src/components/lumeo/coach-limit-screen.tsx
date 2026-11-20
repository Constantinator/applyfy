"use client";

import { useEffect, useId, useRef } from "react";

import { LumeoAvatar } from "@/components/lumeo/lumeo-avatar";
import { PlanChoice } from "@/components/premium/plan-choice";
import { CVB_COACH_DAILY_LIMIT } from "@/lib/ai-usage-limits";
import { COACH_LIMIT_TEXTS as T } from "@/lib/lumeo-texts";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Écran de limite du coach (plan gratuit) : par-dessus le chat (éditeur du CV Builder ou panneau de
 * Lumeo), jamais en page entière. Boîte de dialogue : focus à l'ouverture, piégé à l'intérieur,
 * Échap ou « Plus tard » ferment et rendent la main au chat (onClose). Le parent doit être en
 * position relative.
 */
export function CoachLimitScreen({ paymentEnabled, onClose }: { paymentEnabled: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Ouverture : le focus entre dans la boîte de dialogue (sur son titre).
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    // Focus piégé : Tab et Maj+Tab tournent dans la boîte de dialogue.
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={onKeyDown}
      className="absolute inset-0 z-30 overflow-y-auto rounded-[inherit] bg-white p-5 sm:p-6 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="cl-pop">
          <div className="cl-sleep">
            <LumeoAvatar size={72} expression="endormi" standalone />
          </div>
        </div>
        <div className="cl-rise-1 space-y-2">
          <h2 id={titleId} tabIndex={-1} className="text-xl font-bold tracking-title text-ink outline-none dark:text-white">
            {T.title(CVB_COACH_DAILY_LIMIT)}
          </h2>
          <p id={descriptionId} className="text-sm text-muted dark:text-slate-300">
            {T.subtitle}
          </p>
        </div>
        <div className="cl-rise-2 w-full text-left">
          <PlanChoice paymentEnabled={paymentEnabled} stacked />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ui-focus inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-accent dark:text-white"
        >
          {T.later}
        </button>
        <p className="text-sm text-muted dark:text-slate-300">{T.footer}</p>
      </div>
    </div>
  );
}
