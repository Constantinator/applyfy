"use client";

import { useEffect, useRef, useState } from "react";

import { refineCvAction } from "@/app/actions/cv";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { REFINE_MESSAGE_MAX_LENGTH } from "@/lib/cv-types";

const SUGGESTIONS = [
  "Rends les bullet points plus percutants",
  "Ajoute plus de chiffres et résultats",
  "Adapte mieux à l'offre",
  "Raccourcis pour tenir en 1 page",
];

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Réponse en erreur : affichée, mais pas transmise à Claude comme contexte. */
  error?: boolean;
  /** CV avant la modification apportée par cette réponse (pour l'annuler). */
  previousHtml?: string;
  undone?: boolean;
};

/**
 * Chat « Affiner avec l'IA » sous l'éditeur du CV : chaque demande est appliquée par
 * Claude au CV affiché (modifications surlignées), et compte dans le quota mensuel
 * d'adaptations de CV.
 */
export function CvRefineChat({
  applicationId,
  aiEnabled,
  usage,
  resetLabel,
  readCv,
  replaceCv,
  onPendingChange,
}: {
  applicationId: string;
  aiEnabled: boolean;
  /** Adaptations de CV utilisées ce mois-ci (à l'ouverture de la page). */
  usage: AiUsageCount;
  resetLabel: string;
  /** HTML du CV tel qu'affiché dans l'éditeur. */
  readCv: () => string;
  /** Remplace le CV de l'éditeur et retourne le HTML précédent. */
  replaceCv: (html: string) => string;
  onPendingChange: (pending: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [used, setUsed] = useState(usage.used);
  // Limite signalée par le serveur (compteur de la page éventuellement périmé).
  const [limitHit, setLimitHit] = useState(false);
  const nextId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const limitReached = limitHit || isLimitReached({ used, limit: usage.limit });
  const disabled = !aiEnabled || limitReached;
  const lastUndoable = [...messages].reverse().find((m) => m.previousHtml !== undefined && !m.undone);

  // Fait défiler l'historique jusqu'au dernier message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending]);

  function add(message: Omit<Message, "id">) {
    const id = nextId.current++;
    setMessages((list) => [...list, { ...message, id }]);
  }

  async function send() {
    const request = input.trim();
    if (!request || pending || disabled) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    add({ role: "user", content: request });
    setInput("");
    setPending(true);
    onPendingChange(true);
    try {
      const result = await refineCvAction(applicationId, readCv(), request, history);
      if (result.ok) {
        const previousHtml = replaceCv(result.html);
        setUsed(result.usage.used);
        add({ role: "assistant", content: result.reply, previousHtml });
      } else {
        if (result.limitReached) setLimitHit(true);
        add({ role: "assistant", content: result.error, error: true });
      }
    } catch {
      add({ role: "assistant", content: "La demande n'a pas abouti. Réessaie dans un instant.", error: true });
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }

  function undo(message: Message) {
    if (message.previousHtml === undefined) return;
    replaceCv(message.previousHtml);
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, undone: true } : m)));
  }

  return (
    <section aria-labelledby="refine-title" className="card space-y-4 p-5 print:hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="refine-title" className="font-semibold text-slate-900">
            Affiner avec l&apos;IA
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Demande une modification : elle est appliquée directement au CV, surlignée en jaune.
          </p>
        </div>
        {aiEnabled && (
          <p className="shrink-0 text-xs text-slate-500">
            {Math.min(used, usage.limit)}/{usage.limit} adaptations utilisées ce mois-ci
          </p>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation avec l'assistant"
        className="max-h-96 min-h-28 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
      >
        {messages.length === 0 && !pending && (
          <p className="py-6 text-center text-sm text-slate-500">
            Dis à l&apos;assistant ce que tu veux améliorer dans ton CV.
          </p>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id} className="flex flex-col items-start gap-1">
              <p
                className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm whitespace-pre-wrap ring-1 ${
                  message.error ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-slate-800 ring-slate-200"
                }`}
              >
                {message.content}
              </p>
              {message.undone ? (
                <span className="pl-1 text-xs text-slate-500">Modification annulée.</span>
              ) : (
                message === lastUndoable &&
                !pending && (
                  <button
                    type="button"
                    onClick={() => undo(message)}
                    className="pl-1 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900"
                  >
                    Annuler cette modification
                  </button>
                )
              )}
            </div>
          ),
        )}
        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
            />
            L&apos;assistant modifie ton CV… cela peut prendre jusqu&apos;à une minute.
          </p>
        )}
      </div>

      {!aiEnabled ? (
        <p className="text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      ) : limitReached ? (
        <UsageLimitBanner kind="adaptation_cv" resetLabel={resetLabel} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => {
                setInput(suggestion);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label htmlFor="refine-input" className="sr-only">
          Ta demande
        </label>
        <textarea
          id="refine-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée va à la ligne.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={REFINE_MESSAGE_MAX_LENGTH}
          disabled={disabled}
          placeholder="Ex: Rends les bullet points plus percutants, ajoute plus de chiffres..."
          className="input min-w-0 flex-1 resize-none py-2 text-sm"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          {limitReached ? LIMIT_REACHED_LABEL : pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Ton CV et l&apos;offre sont transmis à Claude (Anthropic). Chaque message compte comme une
        adaptation de CV. Pense à enregistrer le CV pour garder les modifications.
      </p>
    </section>
  );
}
