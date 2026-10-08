"use client";

import { useActionState, useState } from "react";

import { followUpAction, type ActionState } from "@/app/actions/applications";

const initialState: ActionState = { status: "idle" };

export function FollowUpBox({
  applicationId,
  defaultMessage,
  contactEmail,
  subject,
  highlight,
}: {
  applicationId: string;
  defaultMessage: string;
  contactEmail: string | null;
  subject: string;
  highlight: boolean;
}) {
  const [message, setMessage] = useState(defaultMessage);
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
      className={`scroll-mt-6 rounded-2xl border bg-white p-4 ${
        highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="relance-title" className="font-semibold text-slate-900">
            Relancer
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {highlight
              ? "Pas de nouvelles depuis un moment : c'est le bon moment pour relancer."
              : "Personnalise le message avant de l'envoyer."}
          </p>
        </div>
        {message !== defaultMessage && (
          <button
            type="button"
            onClick={() => setMessage(defaultMessage)}
            className="text-sm whitespace-nowrap text-slate-500 hover:text-slate-900"
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
          className="input leading-relaxed"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="btn-secondary px-4 py-2 text-sm"
          >
            {copied ? "Copié ✓" : "Copier le message"}
          </button>
          {mailto && (
            <a
              href={mailto}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Ouvrir dans ma messagerie
            </a>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn-primary px-4 py-2 text-sm sm:ml-auto"
          >
            {pending ? "Enregistrement…" : "Marquer comme relancée"}
          </button>
        </div>

        {state.status !== "idle" && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mt-2 text-sm ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
