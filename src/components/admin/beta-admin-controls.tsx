"use client";

import { useState, useTransition } from "react";

import {
  addBetaTesterAction,
  reactivateBetaTesterAction,
  removeBetaAccessAction,
  sendBetaMessageAction,
} from "@/app/actions/beta-admin";
import { BETA_PREMIUM_UNTIL_LABEL } from "@/lib/beta-rules";

/** Formulaire « Envoyer un message » : à un beta testeur ou à tous les testeurs actifs. */
export function BetaMessageForm({
  testers,
  initialTarget = "all",
}: {
  /** Testeurs (id, email, statut, désinscrit des e-mails). */
  testers: { userId: string; email: string; active: boolean; unsubscribed: boolean }[];
  initialTarget?: string;
}) {
  const [target, setTarget] = useState(initialTarget);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const activeCount = testers.filter((t) => t.active && !t.unsubscribed).length;

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
          <label htmlFor="beta-target" className="text-sm font-medium text-ink">
            Destinataire
          </label>
          <select id="beta-target" value={target} onChange={(e) => setTarget(e.target.value)} className="ui-input py-2">
            <option value="all">Tous les beta testeurs actifs joignables ({activeCount})</option>
            {testers.map((t) => (
              <option key={t.userId} value={t.userId}>
                {t.email}
                {t.active ? "" : " (inactif)"}
                {t.unsubscribed ? " (désinscrit des e-mails)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="beta-subject" className="text-sm font-medium text-ink">
            Objet
          </label>
          <input
            id="beta-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            required
            className="ui-input py-2"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="beta-message" className="text-sm font-medium text-ink">
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
          className="ui-input"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? "Envoi…" : "Envoyer l'email"}
        </button>
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ink dark:text-slate-200" : "text-red-700"}`}>
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
        className="ui-btn-danger"
      >
        Retirer l&apos;accès beta
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">Retirer l&apos;accès de {email} ?</p>
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
          className="ui-btn-danger"
        >
          {pending ? "Retrait…" : "Confirmer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="ui-btn-secondary">
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** « Réactiver » un testeur suspendu ou retiré, avec confirmation (le calendrier des rapports repart à zéro). */
export function ReactivateBetaButton({ userId, email }: { userId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ui-btn-secondary"
      >
        Réactiver
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">
        Réactiver {email} ? Ses rapports non soumis auront de nouvelles dates limites à partir d&apos;aujourd&apos;hui.
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await reactivateBetaTesterAction(userId, email);
              if (!result.ok) setError(result.error);
            })
          }
          className="ui-btn-primary"
        >
          {pending ? "Réactivation…" : "Confirmer"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="ui-btn-secondary">
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** « Ajouter à la beta » : compte existant retrouvé par son email (ajout ou réactivation). */
export function AddBetaTesterForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await addBetaTesterAction(email);
      if (response.ok) {
        setResult({ ok: true, text: response.message });
        setEmail("");
      } else {
        setResult({ ok: false, text: response.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="beta-add-email" className="text-sm font-medium text-ink">
          E-mail du compte
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="beta-add-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            autoComplete="off"
            placeholder="prenom@exemple.fr"
            className="ui-input min-h-11 min-w-0 flex-1 basis-64 py-2"
          />
          <button type="submit" disabled={pending} className="ui-btn-primary">
            {pending ? "Ajout…" : "Ajouter à la beta"}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Compte existant uniquement. Ajout ou réactivation : Premium jusqu&apos;au {BETA_PREMIUM_UNTIL_LABEL}, rapports à partir
        d&apos;aujourd&apos;hui, aucun email envoyé. Possible même si les places sont prises.
      </p>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ink" : "text-red-700"}`}>
          {result.text}
        </p>
      )}
    </form>
  );
}
