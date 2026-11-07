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
    <section aria-labelledby="start-title" className="ui-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="start-title" className="text-lg font-semibold tracking-title text-ink dark:text-white">
            Pour bien démarrer
          </h2>
          <p className="mt-0.5 text-sm text-muted dark:text-slate-300">
            {progress.done} étape{progress.done > 1 ? "s" : ""} sur {progress.total}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="ui-focus inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
        >
          Masquer
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Progression"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft dark:bg-slate-800"
      >
        <div className="h-full rounded-full bg-accent transition-[width] dark:bg-blue-500" style={{ width: `${progress.percent}%` }} />
      </div>

      <ul className="mt-3">
        {allSteps.map((step) => (
          <li key={step.id} className="flex min-h-11 items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-accent text-white dark:bg-blue-500"
                  : "ring-1 ring-line-strong dark:ring-slate-600"
              }`}
            >
              {step.done && "✓"}
            </span>
            {step.done ? (
              <span className="min-w-0 text-muted dark:text-slate-400">
                <span className="sr-only">Fait : </span>
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className="ui-link inline-flex min-h-11 min-w-0 items-center"
              >
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
