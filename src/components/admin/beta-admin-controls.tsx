"use client";

import { useState, useTransition } from "react";

import { removeBetaAccessAction, sendBetaMessageAction } from "@/app/actions/beta-admin";

/** Formulaire « Envoyer un message » : à un beta testeur ou à tous les testeurs actifs. */
export function BetaMessageForm({
  testers,
  initialTarget = "all",
}: {
  /** Testeurs joignables (id, email, statut). */
  testers: { userId: string; email: string; active: boolean }[];
  initialTarget?: string;
}) {
  const [target, setTarget] = useState(initialTarget);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const activeCount = testers.filter((t) => t.active).length;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await sendBetaMessageAction({ target, subject, message });
      if (response.ok) {
        setResult({ ok: true, text: response.message });
        setSubject("");
        setMessage("");
      } else {
        setResult({ ok: false, text: response.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-1.5">
          <label htmlFor="beta-target" className="text-sm font-medium text-slate-700">
            Destinataire
          </label>
          <select id="beta-target" value={target} onChange={(e) => setTarget(e.target.value)} className="input py-2">
            <option value="all">Tous les beta testeurs actifs ({activeCount})</option>
            {testers.map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.email}
                {t.active ? "" : " (inactif)"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="beta-subject" className="text-sm font-medium text-slate-700">
            Objet
          </label>
          <input
            id="beta-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            required
            className="input py-2"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="beta-message" className="text-sm font-medium text-slate-700">
          Message
        </label>
        <textarea
          id="beta-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          rows={6}
          required
          placeholder="Une ligne vide sépare les paragraphes."
          className="input"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
          {pending ? "Envoi…" : "Envoyer le message"}
        </button>
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
            {result.text}
          </p>
        )}
      </div>
    </form>
  );
}

/** « Retirer l'accès beta », avec confirmation. */
export function RemoveBetaButton({ userId, email }: { userId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap text-red-700 ring-1 ring-red-300 hover:bg-red-50"
      >
        Retirer l&apos;accès beta
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-600">Retirer l&apos;accès de {email} ?</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeBetaAccessAction(userId);
              if (!result.ok) setError(result.error);
            })
          }
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Retrait…" : "Confirmer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="btn-secondary px-3 py-1.5 text-xs">
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
