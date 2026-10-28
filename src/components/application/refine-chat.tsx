"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { PremiumButton, UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { REFINE_MESSAGE_MAX_LENGTH } from "@/lib/cv-types";
import type { DocumentChatResult } from "@/lib/refine";

/** Textes propres à chaque document (CV amélioré, lettre de motivation). */
const DOCUMENTS = {
  cv: {
    intro: "Demande une modification : elle est appliquée directement au CV, surlignée en jaune.",
    empty: "Dis à l'assistant ce que tu veux améliorer dans ton CV. Il s'appuie sur l'analyse de ton CV si tu l'as lancée sur la fiche.",
    pending: "L'assistant modifie ton CV… cela peut prendre jusqu'à une minute.",
    placeholder: "Ex: Rends les bullet points plus percutants, ajoute plus de chiffres...",
    privacy: "Ton CV, son analyse et l'offre sont transmis à Claude (Anthropic).",
    save: "Pense à enregistrer le CV pour garder les modifications.",
    units: { one: "message", many: "messages", used: "utilisés" },
    suggestions: [
      "Adapte mon CV à l'offre",
      "Rends les bullet points plus percutants",
      "Ajoute plus de chiffres et résultats",
      "Raccourcis pour tenir en 1 page",
    ],
  },
  // CV Builder : coach qui pose des questions et met à jour le CV (enregistrement automatique).
  cvBuilder: {
    intro: "Réponds aux questions du coach : il intègre tes réponses directement dans ton CV.",
    empty: "Écris au coach ce que tu veux améliorer dans ton CV, ou pose-lui une question.",
    pending: "Le coach réfléchit… cela peut prendre quelques secondes.",
    placeholder: "Ta réponse…",
    privacy: "Le contenu de ton CV (sans la photo) est transmis à Claude (Anthropic).",
    save: "Seules les réponses qui modifient ton CV comptent. Les modifications sont enregistrées automatiquement.",
    units: { one: "adaptation IA", many: "adaptations IA", used: "utilisées" },
    suggestions: [],
  },
  lettre: {
    intro: "Demande à l'assistant de rédiger ta lettre ou de la modifier : les changements sont surlignés en jaune.",
    empty: "Demande à l'assistant de rédiger ta lettre à partir de l'offre et de ton CV, ou ce que tu veux y améliorer.",
    pending: "L'assistant travaille sur ta lettre… cela peut prendre jusqu'à une minute.",
    placeholder: "Ex: Rends l'accroche plus percutante, adopte un ton plus direct...",
    privacy: "Ta lettre, ton CV et l'offre sont transmis à Claude (Anthropic).",
    save: "Pense à enregistrer la lettre pour garder les modifications.",
    units: { one: "message", many: "messages", used: "utilisés" },
    suggestions: [
      "Rédige ma lettre",
      "Rends l'accroche plus percutante",
      "Ajoute des exemples concrets",
      "Adapte mieux à l'offre",
    ],
  },
} as const;

/** Commandes du chat utilisables par l'éditeur (ex. panneau « Ce qui manque »). */
export type RefineChatHandle = {
  insert: (text: string) => void;
  /**
   * Fait poser au coach une question ciblée sur `point` (clic sur une correction du score),
   * affichée comme son message. Renvoie null si elle est demandée, sinon pourquoi rien n'est envoyé.
   */
  ask: (point: string) => string | null;
};

/** Question ciblée du coach (Server Action) : son texte, ou l'erreur à afficher. */
export type AskCoach = (
  id: string,
  json: string,
  point: string,
  history: unknown,
) => Promise<{ ok: true; reply: string } | { ok: false; error: string; limitReached?: boolean }>;

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Réponse en erreur : affichée, mais pas transmise à Claude comme contexte. */
  error?: boolean;
  /** Document avant la modification apportée par cette réponse (pour l'annuler). */
  previousHtml?: string;
  undone?: boolean;
  /** Message de limite : suivi du bouton « Passer au Premium ». */
  premium?: boolean;
};

/**
 * Chat « Affiner avec l'IA » sous l'éditeur (CV amélioré ou lettre) : chaque demande est
 * appliquée par Claude au document affiché (modifications surlignées). Chaque message
 * compte dans la limite mensuelle du chat de ce document.
 */
export function RefineChat({
  document,
  applicationId,
  aiEnabled,
  usage,
  resetLabel,
  refine,
  readDocument,
  replaceDocument,
  onPendingChange,
  initialPrompt,
  controlRef,
  opening,
  askCoach,
  limitMessage,
  limitBlocks = true,
  tall = false,
}: {
  document: keyof typeof DOCUMENTS;
  applicationId: string;
  aiEnabled: boolean;
  /** Messages utilisés ce mois-ci (à l'ouverture de la page). */
  usage: AiUsageCount;
  /** Date de remise à zéro du compteur (ex. « 1er novembre 2026 »). */
  resetLabel: string;
  /** Server Action d'affinage du document. */
  refine: (id: string, html: string, message: string, history: unknown) => Promise<DocumentChatResult>;
  /** HTML du document tel qu'affiché dans l'éditeur. */
  readDocument: () => string;
  /** Remplace le document de l'éditeur et retourne le HTML précédent. */
  replaceDocument: (html: string) => string;
  onPendingChange: (pending: boolean) => void;
  /** Demande envoyée automatiquement à l'ouverture (ex. « S'aider du CV en cours »). */
  initialPrompt?: string;
  /** Accès aux commandes du chat (insérer un texte dans le champ de saisie). */
  controlRef?: React.Ref<RefineChatHandle>;
  /** Premier message de l'assistant, demandé à l'ouverture (null : pas de message). */
  opening?: () => Promise<string | null>;
  /** Question ciblée du coach, demandée par `controlRef.ask` (CV Builder). */
  askCoach?: AskCoach;
  /** Message du bandeau Premium quand la limite du mois est atteinte. */
  limitMessage?: string;
  /**
   * Limite du mois atteinte : chat désactivé (par défaut). false (coach du CV Builder) : le chat
   * reste ouvert, seules les modifications du document sont refusées par le serveur.
   */
  limitBlocks?: boolean;
  /** Historique plus haut (chat en colonne à côté de l'aperçu). */
  tall?: boolean;
}) {
  const texts = DOCUMENTS[document];
  const units = texts.units;
  const [messages, setMessages] = useState<Message[]>([]);
  const [openingPending, setOpeningPending] = useState(Boolean(opening && aiEnabled));
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [used, setUsed] = useState(usage.used);
  // Limite signalée par le serveur (compteur de la page éventuellement périmé).
  const [limitHit, setLimitHit] = useState(false);
  const nextId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Question ciblée du coach : affichée comme son message, sans message du candidat. */
  async function ask(action: AskCoach, point: string) {
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setPending(true);
    onPendingChange(true);
    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    try {
      const result = await action(applicationId, readDocument(), point, history);
      if (result.ok) add({ role: "assistant", content: result.reply });
      else {
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

  const limitReached = limitHit || isLimitReached({ used, limit: usage.limit });
  const blocked = limitBlocks && limitReached;
  const disabled = !aiEnabled || blocked;

  // Insertion depuis l'éditeur : ajouté au texte déjà saisi, puis le champ prend le focus.
  useImperativeHandle(controlRef, () => {
    const insert = (text: string) => {
      setInput((current) =>
        (current.trim() ? `${current.trimEnd()}\n${text}` : text).slice(0, REFINE_MESSAGE_MAX_LENGTH),
      );
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    return {
      insert,
      ask(point: string) {
        if (!askCoach || !aiEnabled) return "L'assistant n'est pas disponible pour le moment.";
        if (pending) return "Le coach est occupé : attends sa réponse.";
        if (blocked) return limitMessage ?? "Limite du chat atteinte pour ce mois-ci.";
        void ask(askCoach, point);
        return null;
      },
    };
  });

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

  async function send(text: string = input) {
    const request = text.trim();
    if (!request || pending || disabled) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    add({ role: "user", content: request });
    setInput("");
    setPending(true);
    onPendingChange(true);
    try {
      const result = await refine(applicationId, readDocument(), request, history);
      if (result.ok) {
        // html null : réponse sans modification du document (rien à annuler).
        const previousHtml = result.html === null ? undefined : replaceDocument(result.html);
        setUsed(result.usage.used);
        // Modification refusée (limite du mois) : le message de limite, puis la suite du coach.
        if (result.limitNotice) {
          setLimitHit(true);
          add({ role: "assistant", content: result.limitNotice, premium: true });
        }
        if (result.reply) add({ role: "assistant", content: result.reply, previousHtml });
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

  // Premier message de l'assistant : demandé une seule fois, à l'ouverture.
  const openingAsked = useRef(false);
  useEffect(() => {
    if (!opening || !aiEnabled || openingAsked.current) return;
    openingAsked.current = true;
    opening()
      .then((text) => {
        // Placé avant les messages déjà envoyés pendant le chargement.
        if (text) setMessages((list) => [{ id: -1, role: "assistant", content: text }, ...list]);
      })
      .catch(() => {})
      .finally(() => setOpeningPending(false));
  }, [opening, aiEnabled]);

  // Demande initiale : envoyée une seule fois, juste après l'ouverture de l'éditeur.
  const initialSent = useRef(false);
  useEffect(() => {
    if (!initialPrompt || initialSent.current || disabled) return;
    // Marqué envoyé dans le minuteur : un effet annulé puis rejoué (mode strict) envoie bien.
    const timer = setTimeout(() => {
      if (initialSent.current) return;
      initialSent.current = true;
      void send(initialPrompt);
    }, 0);
    return () => clearTimeout(timer);
    // send lit l'état courant au moment de l'appel : inutile de relancer l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, disabled]);

  function undo(message: Message) {
    if (message.previousHtml === undefined) return;
    replaceDocument(message.previousHtml);
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, undone: true } : m)));
  }

  return (
    <section aria-labelledby="refine-title" className="card space-y-4 p-5 print:hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="refine-title" className="font-semibold text-slate-900 dark:text-white">
            Affiner avec l&apos;IA
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{texts.intro}</p>
        </div>
        {aiEnabled && (
          <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {usage.limit === null
              ? `${used} ${used > 1 ? units.many : units.one} ce mois-ci · illimité`
              : `${Math.min(used, usage.limit)}/${usage.limit} ${units.many} ${units.used} ce mois-ci`}
          </p>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation avec l'assistant"
        className={`${tall ? "max-h-[55vh] min-h-48" : "max-h-96 min-h-28"} space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700`}
      >
        {messages.length === 0 && !pending && !openingPending && (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{texts.empty}</p>
        )}
        {openingPending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
            />
            Lecture de ton CV…
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
                  message.error
                    ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30"
                    : "bg-white text-slate-800 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                }`}
              >
                {message.content}
              </p>
              {message.premium && <PremiumButton />}
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
            {texts.pending}
          </p>
        )}
      </div>

      {!aiEnabled ? (
        <p className="text-xs text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      ) : limitReached ? (
        <UsageLimitBanner resetLabel={resetLabel} message={limitMessage} premiumBadge={limitMessage !== undefined} />
      ) : texts.suggestions.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {texts.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => {
                setInput(suggestion);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
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
          placeholder={texts.placeholder}
          className="input min-w-0 flex-1 resize-none py-2 text-sm"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          {blocked ? LIMIT_REACHED_LABEL : pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {texts.privacy}{" "}
        {usage.limit !== null && (
          <>
            {usage.limit} {usage.limit > 1 ? units.many : units.one} par mois avec le plan gratuit.{" "}
          </>
        )}
        {texts.save}
      </p>
    </section>
  );
}
