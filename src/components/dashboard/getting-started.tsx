"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  canInstallExtension,
  startProgress,
  withExtensionStep,
  type ExtensionState,
  type StartStep,
} from "@/lib/dashboard-start";
import { isExtensionAvailable } from "@/lib/extension-bridge";

const STORAGE_KEY = "applyfy:demarrage-masque";

// Stockage indisponible (navigation privée stricte…) : bloc masqué le temps de la visite seulement.
let dismissedForVisit = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isDismissed() {
  if (dismissedForVisit) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function dismiss() {
  dismissedForVisit = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // Déjà masqué pour cette visite.
  }
  listeners.forEach((listener) => listener());
}

/** « Pour bien démarrer » : disparaît quand tout est fait ou sur « Masquer » (mémoire du navigateur). */
export function GettingStarted({ steps }: { steps: StartStep[] }) {
  // Côté serveur : rien, la mémoire et la détection de l'extension sont dans le navigateur.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const [extension, setExtension] = useState<ExtensionState>("unavailable");

  useEffect(() => {
    let active = true;
    void isExtensionAvailable().then((installed) => {
      if (!active) return;
      if (installed) setExtension("installed");
      else if (canInstallExtension(window.navigator.userAgent)) setExtension("missing");
    });
    return () => {
      active = false;
    };
  }, []);

  const allSteps = withExtensionStep(steps, extension);
  const progress = startProgress(allSteps);
  if (dismissed || progress.complete) return null;

  return (
    <section
      aria-labelledby="start-title"
      className="rounded-[28px] border border-line bg-surface p-5 sm:px-8 sm:py-7 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="start-title" className="ui-title">
          Pour bien démarrer
        </h2>
        <p className="text-[15px] text-muted dark:text-slate-300">
          · {progress.done} / {progress.total} faites
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Progression"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        className="mt-3 h-1.5 max-w-[420px] overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-slate-800"
      >
        <div className="h-full rounded-full bg-accent transition-[width] dark:bg-blue-500" style={{ width: `${progress.percent}%` }} />
      </div>

      <ul className="mt-3 divide-y divide-line dark:divide-slate-800">
        {allSteps.map((step, index) => (
          <li key={step.id} className="flex min-h-[52px] items-center gap-3 text-[15px] font-semibold text-ink dark:text-white">
            <span
              aria-hidden="true"
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-xs font-semibold ${
                step.done
                  ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                  : "border border-[#A1A1AA] text-muted dark:text-slate-400"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            {step.done ? (
              <span className="min-w-0">
                <span className="sr-only">Fait : </span>
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className="ui-focus inline-flex min-h-11 min-w-0 items-center underline-offset-2 hover:underline"
              >
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={dismiss}
        className="ui-focus mt-1 inline-flex min-h-11 items-center text-sm font-medium text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
      >
        Masquer
      </button>
    </section>
  );
}
