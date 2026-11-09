"use client";

import { useState, useTransition } from "react";

import { setEmailsSubscribedAction } from "@/app/actions/profile";

/** Interrupteur « Recevoir les e-mails d'Applyfy » : désinscription ou réinscription, dans les deux sens. */
export function EmailSubscriptionToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setResult(null);
    startTransition(async () => {
      const response = await setEmailsSubscribedAction(next);
      if (response.ok) {
        setResult({ ok: true, text: response.message });
      } else {
        setOn(!next);
        setResult({ ok: false, text: response.error });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="emails-toggle-label"
        aria-describedby="emails-toggle-hint"
        disabled={pending}
        onClick={toggle}
        className="ui-focus flex min-h-11 w-full items-center justify-between gap-4 rounded-block text-left disabled:opacity-60"
      >
        <span>
          <span id="emails-toggle-label" className="block text-sm font-medium text-ink dark:text-white">
            Recevoir les e-mails d&apos;Applyfy
          </span>
          <span id="emails-toggle-hint" className="block text-xs text-muted dark:text-slate-400">
            Bienvenue, activation, rappels de relance et messages de l&apos;équipe. Les e-mails de service (compte, accès
            bêta) continuent dans tous les cas.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            on ? "bg-ink dark:bg-accent" : "bg-line-strong"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
      </button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ink dark:text-slate-200" : "text-red-700"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
