"use client";

import { BrandLogo } from "@/components/logo";
import { GUIDE_TEXTS as T } from "@/lib/lumeo-texts";
import { guideStepIndex } from "@/lib/onboarding-guide";
import type { GuideStep } from "@/lib/onboarding";

/**
 * En-tête de la phase guidée (CV Builder, puis écran de l'offre) : logo, les 3 étapes (celle en
 * cours en aria-current="step") et « Passer », seule sortie, toujours visible et jamais désactivée.
 */
export function GuidedHeader({ step, onSkip }: { step: GuideStep; onSkip: () => void }) {
  const current = guideStepIndex(step);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-3 py-2 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
      <BrandLogo />
      <nav aria-label={T.stepsLabel} className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
        <ol className="flex items-center justify-center gap-3 sm:gap-5">
          {T.steps.map((label, index) => {
            const done = index < current;
            const active = index === current;
            return (
              <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-accent text-white"
                      : done
                        ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                        : "border border-[#A1A1AA] text-muted dark:text-slate-300"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                {/* Mobile : seul le libellé de l'étape en cours est affiché (les autres restent lus). */}
                <span
                  className={`${active ? "font-semibold text-ink dark:text-white" : "sr-only text-muted sm:not-sr-only dark:text-slate-300"}`}
                >
                  {label}
                  {done && <span className="sr-only"> ({T.done})</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
      <button
        type="button"
        onClick={onSkip}
        aria-label={T.skipLabel}
        className="ui-focus ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium text-[#6B6B6B] underline-offset-4 hover:text-ink hover:underline dark:text-slate-300 dark:hover:text-white"
      >
        {T.skip}
      </button>
    </div>
  );
}
