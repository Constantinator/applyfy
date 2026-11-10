"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { followUpAction, type ActionState } from "@/app/actions/applications";
import { IconBell } from "@/components/icons";
import { useLumeo } from "@/components/lumeo/lumeo-panel";
import { LUMEO_FICHE_TEXTS } from "@/lib/lumeo-texts";

const initialState: ActionState = { status: "idle" };

export function FollowUpBox({
  applicationId,
  defaultMessage,
  contactEmail,
  subject,
  highlight,
  canImprove = false,
}: {
  applicationId: string;
  defaultMessage: string;
  contactEmail: string | null;
  subject: string;
  highlight: boolean;
  /** « Améliorer avec Lumeo » : candidature envoyée (hors exemple) et IA disponible. */
  canImprove?: boolean;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const lumeo = useLumeo();

  // Lumeo lit le texte de la boîte à la confirmation et peut y mettre son brouillon.
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);
  const register = lumeo?.registerRelanceBox;
  useEffect(() => {
    if (!register) return;
    return register({ applicationId, read: () => messageRef.current, write: setMessage });
  }, [register, applicationId]);
  const showImprove = canImprove && Boolean(lumeo?.aiEnabled);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState(followUpAction, initialState);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const mailto = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    : null;

  return (
    <section
      id="relance"
      aria-labelledby="relance-title"
      className={`scroll-mt-22 p-5 sm:p-7 ${highlight ? "ui-card-soft" : "ui-card"}`}
    >
      <div className="flex items-start justify-between gap-3">
        {highlight && (
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200">
            <IconBell className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="relance-title" className="ui-title-sm">
            Relancer
          </h2>
          <p className="mt-1 text-sm text-muted dark:text-slate-400">
            {highlight
              ? "Pas de nouvelles depuis un moment : c'est le bon moment pour relancer."
              : "Personnalise le message avant de l'envoyer."}
          </p>
        </div>
        {message !== defaultMessage && (
          <button
            type="button"
            onClick={() => setMessage(defaultMessage)}
            className="ui-focus inline-flex min-h-11 items-center text-sm whitespace-nowrap text-muted hover:text-ink lg:min-h-0 dark:text-slate-400 dark:hover:text-white"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <form action={formAction} className="mt-3">
        <input type="hidden" name="id" value={applicationId} />
        <label htmlFor="follow-up-message" className="sr-only">
          Message de relance
        </label>
        <textarea
          id="follow-up-message"
          name="message"
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="ui-input leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="ui-btn-secondary"
          >
            {copied ? "Copié ✓" : "Copier le message"}
          </button>
          {mailto && (
            <a
              href={mailto}
              className="ui-btn-secondary"
            >
              Ouvrir dans ma messagerie
            </a>
          )}
          {showImprove && lumeo && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(e) => void lumeo.proposeRelance(applicationId, e.currentTarget)}
              className="ui-btn-secondary"
            >
              {LUMEO_FICHE_TEXTS.improveRelance}
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="ui-btn-primary sm:ml-auto"
          >
            {pending ? "Enregistrement…" : "Marquer comme relancée"}
          </button>
        </div>

        {state.status !== "idle" && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mt-2 text-sm ${state.status === "error" ? "text-red-600 dark:text-red-400" : "text-ink dark:text-slate-200"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
