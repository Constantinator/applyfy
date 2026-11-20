"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { finishOnboardingAction, saveOnboardingAction } from "@/app/actions/onboarding";
import { IconBriefcase, IconPencil, IconPuzzle } from "@/components/icons";
import { BrandLogo } from "@/components/logo";
import { LumeoAvatar, type LumeoExpression } from "@/components/lumeo/lumeo-avatar";
import {
  ONBOARDING_SEGMENTS,
  nextScreen,
  segmentOf,
  withSkipped,
  type HasCv,
  type JobSearch,
  type OnboardingScreen,
  type OnboardingState,
} from "@/lib/onboarding";
import { ONBOARDING_TEXTS as T } from "@/lib/lumeo-texts";

/** Expression de Lumeo et animation propre à chaque écran (CSS : globals.css, « ob- »). */
const LUMEO_BY_SCREEN: Record<OnboardingScreen, { expression: LumeoExpression; motion: string }> = {
  accueil: { expression: "salue", motion: "ob-wave" },
  apport: { expression: "content", motion: "ob-jump" },
  temps: { expression: "etonne", motion: "ob-wow" },
  cv: { expression: "neutre", motion: "ob-tilt" },
};

const APPORT_ICONS = { suivi: IconBriefcase, cv: IconPencil, remplir: IconPuzzle } as const;

const CARD =
  "w-full rounded-[20px] border-[1.5px] border-[#E4E4E7] bg-white p-5 text-left transition-colors hover:border-accent focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const PRIMARY = "ui-btn-primary h-[52px] min-w-[200px] px-8 text-[15px]";

/** Barre du haut : 4 segments, celui en cours se remplit à l'arrivée sur une nouvelle étape. */
function ProgressBar({ segment }: { segment: number }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label={T.progress(segment, ONBOARDING_SEGMENTS)}
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_SEGMENTS}
        aria-valuenow={segment}
        className="flex gap-2"
      >
        {Array.from({ length: ONBOARDING_SEGMENTS }, (_, i) => i + 1).map((index) => (
          <span key={index} className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#E4E4E7]">
            {index <= segment && (
              <span
                // key : l'animation repart quand on arrive sur une nouvelle étape.
                key={index === segment ? `en-cours-${segment}` : "fait"}
                className={`absolute inset-0 rounded-[3px] bg-accent ${index === segment ? "ob-fill" : ""}`}
              />
            )}
          </span>
        ))}
      </div>
      {/* Repère écrit : la progression ne dépend pas seulement de la couleur. */}
      <p aria-hidden="true" className="mt-2 text-center text-xs text-muted">
        {T.progress(segment, ONBOARDING_SEGMENTS)}
      </p>
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "grey" | "blue" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tone === "blue" ? "bg-[#EFF4FF] text-[#1D4ED8]" : "bg-[#F4F4F5] text-[#52525B]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Parcours d'accueil plein écran : un écran = une question. Chaque passage d'écran est enregistré
 * (dans l'ordre, sans bloquer l'affichage) ; la fin mène au tableau de bord ou au CV Builder.
 * `timeSavingProof` : emplacement facultatif de l'écran 2 bis pour une preuve chiffrée mesurée
 * (lot futur) ; rien n'est affiché sans elle.
 */
export function OnboardingFlow({
  firstName,
  initial,
  importNote,
  timeSavingProof,
}: {
  firstName: string | null;
  initial: OnboardingState & { step: OnboardingScreen };
  /** Note « Gratuit : … import de CV par mois », null pour les comptes Premium et bêta. */
  importNote: string | null;
  timeSavingProof?: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState & { step: OnboardingScreen }>(initial);
  const [leaving, setLeaving] = useState(false);
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstScreen = useRef(true);
  const screen = state.step;

  // Nouvel écran : le focus va sur son titre (lecteurs d'écran, clavier). Pas au premier affichage.
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [screen]);

  /** Enregistrements à la suite (jamais deux en même temps, le dernier fait foi). */
  function queue(task: () => Promise<unknown>) {
    saves.current = saves.current.then(task).catch(() => undefined);
    return saves.current;
  }

  function goTo(next: OnboardingState & { step: OnboardingScreen }) {
    setState(next);
    void queue(() => saveOnboardingAction(next));
  }

  function advance(from: OnboardingState) {
    const next = nextScreen(screen);
    if (next) goTo({ ...from, step: next });
    else finish(from, "/dashboard");
  }

  function finish(final: OnboardingState, href: string) {
    if (leaving) return;
    setLeaving(true);
    // Quoi qu'il arrive à l'enregistrement, la personne part (pas de blocage, pas de boucle).
    void queue(() => finishOnboardingAction(final)).then(() => router.push(href));
  }

  const skip = () => advance(withSkipped(state, screen));
  const answerJob = (jobSearch: JobSearch) => advance({ ...state, jobSearch });
  const answerCv = (hasCv: HasCv) => finish({ ...state, hasCv }, hasCv === "oui" ? "/cv-builder" : "/dashboard");

  const lumeo = LUMEO_BY_SCREEN[screen];
  const titleClass =
    "ob-rise-1 text-center text-[32px] leading-[1.1] font-bold tracking-[-0.035em] text-ink outline-none sm:text-[42px]";

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-page text-ink">
      <header className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 pt-4 sm:grid-cols-[1fr_minmax(0,560px)_1fr] sm:px-8 sm:pt-6">
        <span className="col-start-1 row-start-1">
          <BrandLogo />
        </span>
        <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <ProgressBar segment={segmentOf(screen)} />
        </div>
        <button
          type="button"
          onClick={skip}
          disabled={leaving}
          aria-label={T.skipLabel}
          className="ui-focus col-start-2 row-start-1 inline-flex min-h-11 items-center justify-self-end px-2 text-sm font-medium text-[#6B6B6B] underline-offset-4 hover:text-ink hover:underline sm:col-start-3"
        >
          {T.skip}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* key : à chaque écran, les animations d'entrée repartent du début. */}
        <div key={screen} className="flex w-full max-w-[560px] flex-col items-center gap-6">
          <div className="ob-pop">
            <div className={lumeo.motion}>
              <LumeoAvatar size={120} expression={lumeo.expression} standalone />
            </div>
          </div>

          {screen === "accueil" && (
            <>
              <div className="space-y-2 text-center">
                <h1 ref={titleRef} tabIndex={-1} className={titleClass}>
                  {T.accueil.title(firstName)}
                </h1>
                <p className="ob-rise-1 text-lg text-ink">{T.accueil.question}</p>
              </div>
              <div className="ob-rise-2 grid w-full gap-3 sm:grid-cols-2">
                {(
                  [
                    ["oui", T.accueil.oui],
                    ["pas_encore", T.accueil.pasEncore],
                  ] as const
                ).map(([value, text]) => (
                  <button key={value} type="button" onClick={() => answerJob(value)} disabled={leaving} className={CARD}>
                    <span className="block text-[17px] font-semibold text-ink">{text.title}</span>
                    <span className="mt-1 block text-sm text-muted">{text.detail}</span>
                  </button>
                ))}
              </div>
              <p className="ob-rise-2 text-center text-sm text-muted">{T.accueil.note}</p>
            </>
          )}

          {screen === "apport" && (
            <>
              <h1 ref={titleRef} tabIndex={-1} className={titleClass}>
                {T.apport.title}
              </h1>
              <ul className="ob-rise-2 w-full space-y-3">
                {T.apport.items.map((item) => {
                  const Icon = APPORT_ICONS[item.key];
                  return (
                    <li key={item.key} className="flex items-start gap-4 rounded-[20px] border-[1.5px] border-[#E4E4E7] bg-white p-4">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-accent"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{item.title}</span>
                          {item.soon && <Pill tone="grey">{T.apport.soon}</Pill>}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{item.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => advance(state)} disabled={leaving} className={`ob-rise-2 ${PRIMARY}`}>
                {T.continue}
              </button>
            </>
          )}

          {screen === "temps" && (
            <>
              <div className="space-y-3 text-center">
                <h1 ref={titleRef} tabIndex={-1} className={titleClass}>
                  {T.temps.title}
                </h1>
                <p className="ob-rise-1 text-lg text-muted">{T.temps.detail}</p>
              </div>
              {timeSavingProof && <div className="ob-rise-2 w-full">{timeSavingProof}</div>}
              <button type="button" onClick={() => advance(state)} disabled={leaving} className={`ob-rise-2 ${PRIMARY}`}>
                {T.continue}
              </button>
            </>
          )}

          {screen === "cv" && (
            <>
              <div className="space-y-2 text-center">
                <h1 ref={titleRef} tabIndex={-1} className={titleClass}>
                  {T.cv.title}
                </h1>
                <p className="ob-rise-1 text-lg text-muted">{T.cv.subtitle}</p>
              </div>
              <div className="ob-rise-2 grid w-full gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => answerCv("oui")} disabled={leaving} className={CARD}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] font-semibold text-ink">{T.cv.add.title}</span>
                    <Pill tone="blue">{T.cv.add.badge}</Pill>
                  </span>
                  <span className="mt-1 block text-sm text-muted">{T.cv.add.detail}</span>
                </button>
                <button type="button" onClick={() => answerCv("plus_tard")} disabled={leaving} className={CARD}>
                  <span className="block text-[17px] font-semibold text-ink">{T.cv.later.title}</span>
                  <span className="mt-1 block text-sm text-muted">{T.cv.later.detail}</span>
                </button>
              </div>
              {importNote && <p className="ob-rise-2 text-center text-sm text-muted">{importNote}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
