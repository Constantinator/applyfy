"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  markMyBetaMessagesReadAction,
  markThreadReadAction,
  sendAdminBetaMessageAction,
  sendMyBetaMessageAction,
  type MessageActionResult,
} from "@/app/actions/beta-messages";
import type { BetaMessage } from "@/lib/beta-messages";

const MAX_LENGTH = 5000;

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/**
 * Fil de discussion (bulles + champ d'envoi). Les messages reçus non lus sont marqués lus à
 * l'affichage, puis la page est rafraîchie pour mettre à jour le badge de la sidebar.
 */
function Thread({
  messages,
  viewer,
  otherLabel,
  hasUnread,
  markRead,
  send,
  placeholder,
}: {
  messages: BetaMessage[];
  viewer: "tester" | "admin";
  /** Nom affiché pour l'interlocuteur. */
  otherLabel: string;
  hasUnread: boolean;
  markRead: () => Promise<void>;
  send: (body: string) => Promise<MessageActionResult>;
  placeholder: string;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!hasUnread) return;
    void markRead().then(() => router.refresh());
  }, [hasUnread, markRead, router]);

  // Dernier message visible.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await send(body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div ref={listRef} role="log" aria-label="Historique des messages" className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Aucun message pour l&apos;instant.</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender === viewer;
            return (
              <div key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${
                    mine ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.body}
                </div>
                <span className="mt-0.5 px-1 text-xs text-slate-400">
                  {mine ? "Toi" : otherLabel} · {timeFormatter.format(new Date(message.createdAt))}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-slate-100 pt-3">
        <label htmlFor={`message-${viewer}`} className="sr-only">
          Ton message
        </label>
        <textarea
          id={`message-${viewer}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder={placeholder}
          className="input"
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !body.trim()} className="btn-primary px-4 py-2 text-sm">
          {pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </div>
  );
}

/** Messagerie du beta testeur avec l'équipe Applyfy (page /beta). */
export function TesterMessages({ messages }: { messages: BetaMessage[] }) {
  return (
    <Thread
      messages={messages}
      viewer="tester"
      otherLabel="Équipe Applyfy"
      hasUnread={messages.some((m) => m.sender === "admin" && !m.readAt)}
      markRead={markMyBetaMessagesReadAction}
      send={sendMyBetaMessageAction}
      placeholder="Une question, un bug, une idée ? Écris à l'équipe Applyfy…"
    />
  );
}

/** Fil d'un beta testeur côté équipe (/admin/beta). */
export function AdminThread({ testerId, email, messages }: { testerId: string; email: string; messages: BetaMessage[] }) {
  return (
    <Thread
      messages={messages}
      viewer="admin"
      otherLabel={email}
      hasUnread={messages.some((m) => m.sender === "tester" && !m.readAt)}
      markRead={() => markThreadReadAction(testerId)}
      send={(body) => sendAdminBetaMessageAction({ target: testerId, body })}
      placeholder={`Réponds à ${email}…`}
    />
  );
}

/** Message interne à tous les beta testeurs actifs (copié dans chaque fil). */
export function BroadcastMessageForm({ activeCount }: { activeCount: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await sendAdminBetaMessageAction({ target: "all", body });
      if (!response.ok) {
        setResult({ ok: false, text: response.error });
        return;
      }
      setBody("");
      setResult({ ok: true, text: response.message ?? "Message envoyé." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="broadcast-message" className="text-sm font-medium text-slate-700">
        À tous les beta testeurs actifs ({activeCount})
      </label>
      <textarea
        id="broadcast-message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder="Annonce, nouveauté à tester… (le message apparaît dans le fil de chaque testeur)"
        className="input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !body.trim() || activeCount === 0} className="btn-primary px-4 py-2 text-sm">
          {pending ? "Envoi…" : "Envoyer à tous"}
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
