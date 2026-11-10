"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";

import { PremiumButton, UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { isLimitReached, LIMIT_REACHED_LABEL, type AiUsageCount } from "@/lib/ai-usage-limits";
import { REFINE_MESSAGE_MAX_LENGTH } from "@/lib/cv-types";
import { isNearBottom, lumeoScrollAction } from "@/lib/lumeo-panel";
import { LUMEO_PANEL_TEXTS, LUMEO_TEXTS } from "@/lib/lumeo-texts";
import type { DocumentChatResult } from "@/lib/refine";

import { LumeoAvatar, type LumeoExpression } from "@/components/lumeo/lumeo-avatar";
import { LumeoHeader } from "@/components/lumeo/lumeo-header";

import { ChatMarkdown, type ChatLinkFilter } from "./chat-markdown";

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
  // CV Builder : Lumeo pose des questions et met à jour le CV (enregistrement automatique).
  cvBuilder: {
    intro: LUMEO_TEXTS.intro,
    empty: LUMEO_TEXTS.empty,
    pending: LUMEO_TEXTS.pending,
    placeholder: "Ta réponse…",
    privacy: "Le contenu de ton CV (sans la photo) est transmis à Claude (Anthropic).",
    save: "Seules les réponses qui modifient ton CV comptent. Les modifications sont enregistrées automatiquement.",
    units: { one: "adaptation IA", many: "adaptations IA", used: "utilisées" },
    suggestions: [],
  },
  // Panneau global de Lumeo : questions sans document (suggestions passées par page).
  lumeo: {
    intro: LUMEO_PANEL_TEXTS.tagline,
    empty: LUMEO_PANEL_TEXTS.empty,
    pending: LUMEO_PANEL_TEXTS.pending,
    placeholder: LUMEO_PANEL_TEXTS.placeholder,
    privacy: LUMEO_PANEL_TEXTS.privacy,
    save: "",
    units: { one: "question", many: "questions", used: "posées" },
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
};

/** Échange du chat tel que transmis à l'assistant (et enregistré). */
export type ChatTurn = { role: "user" | "assistant"; content: string };
const NO_MESSAGES: ChatTurn[] = [];

export type ChatMessage = Message;

/**
 * État d'une conversation tenu hors du chat (Lumeo : panneau et page /lumeo partagent la même
 * conversation). Sans `store`, le chat garde son état interne.
 */
export type ChatStore = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  pending: boolean;
  setPending: (pending: boolean) => void;
  /** Identifiant du prochain message (unique dans la conversation). */
  nextId: () => number;
};

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
  /** Excuse de Lumeo (erreur, limite) : bulle normale, expression « désolé », hors historique. */
  sorry?: boolean;
};

/** Expression de Lumeo à côté d'une réponse : désolé sur une erreur ou une limite atteinte. */
function assistantExpression(message: Message): LumeoExpression {
  return message.error || message.premium || message.sorry ? "desole" : "content";
}

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
  starter,
  initialMessages = NO_MESSAGES,
  limitMessage,
  limitBlocks = true,
  tall = false,
  fill = false,
  minimal = false,
  markdown = false,
  undoable = true,
  persona,
  suggestions,
  tagline,
  links,
  layout = "card",
  store,
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
  /** Bouton sous le champ de saisie, visible pendant toute la conversation : envoie `message` comme s'il l'avait tapé. */
  starter?: { label: string; message: string };
  /** Conversation reprise à l'ouverture (historique enregistré du coach du CV Builder). */
  initialMessages?: ChatTurn[];
  /** Message du bandeau Premium quand la limite du mois est atteinte. */
  limitMessage?: string;
  /**
   * Limite du mois atteinte : chat désactivé (par défaut). false (coach du CV Builder) : le chat
   * reste ouvert, seules les modifications du document sont refusées par le serveur.
   */
  limitBlocks?: boolean;
  /** Historique plus haut (chat en colonne à côté de l'aperçu). */
  tall?: boolean;
  /** Sur grand écran, remplit la hauteur de son parent (éditeur en plein écran du CV Builder). */
  fill?: boolean;
  /** Seulement les messages et le champ de saisie : sans titre, intro, compteur, bandeau ni mentions. */
  minimal?: boolean;
  /** Messages de l'assistant en markdown minimal (sauts de ligne, puces, gras). */
  markdown?: boolean;
  /** Bouton « Annuler cette modification » sous la dernière réponse qui a modifié le document. */
  undoable?: boolean;
  /** Assistant incarné (CV Builder) : bandeau et avatar de Lumeo à côté de ses messages. */
  persona?: "lumeo";
  /** Suggestions propres au contexte (panneau global : selon la page), à la place de celles du document. */
  suggestions?: readonly string[];
  /** Accroche du bandeau de Lumeo, si elle diffère de celle du CV Builder. */
  tagline?: string;
  /** Liens markdown autorisés dans les réponses (sinon : texte seul). */
  links?: ChatLinkFilter;
  /**
   * « panel » (panneau global) : sans carte, remplit la hauteur de son parent, suggestions
   * seulement quand la conversation est vide (un clic envoie la question), sans bandeau de quota.
   * « page » (/lumeo) : comme « panel », en lecture confortable (texte 16 px, paragraphes aérés),
   * avec un défilement automatique qui ne bouge pas pendant la lecture.
   */
  layout?: "card" | "panel" | "page";
  /** Conversation tenue hors du chat (partagée entre le panneau et la page de Lumeo). */
  store?: ChatStore;
}) {
  const texts = DOCUMENTS[document];
  const page = layout === "page";
  // « page » reprend tout le comportement du panneau (suggestions, pas de carte ni de bandeau).
  const panel = layout === "panel" || page;
  const shownSuggestions = suggestions ?? texts.suggestions;
  // Identifiants uniques : plusieurs chats peuvent cohabiter (fiche + panneau global).
  const uid = useId();
  const titleId = `refine-title-${uid}`;
  const inputId = `refine-input-${uid}`;
  const units = texts.units;
  const [localMessages, setLocalMessages] = useState<Message[]>(() =>
    initialMessages.map((m, id) => ({ id, role: m.role, content: m.content })),
  );
  const [openingPending, setOpeningPending] = useState(Boolean(opening && aiEnabled));
  const [input, setInput] = useState("");
  const [localPending, setLocalPending] = useState(false);
  const [used, setUsed] = useState(usage.used);
  // Limite signalée par le serveur (compteur de la page éventuellement périmé).
  const [limitHit, setLimitHit] = useState(false);
  const localNextId = useRef(initialMessages.length);
  // Conversation partagée (store) ou propre à ce chat.
  const messages = store ? store.messages : localMessages;
  const setMessages = store ? store.setMessages : setLocalMessages;
  const pending = store ? store.pending : localPending;
  const setPending = store ? store.setPending : setLocalPending;
  const listRef = useRef<HTMLDivElement>(null);
  // Page /lumeo : l'utilisateur lisait-il la fin de la conversation avant ce rendu ?
  const nearBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    return { insert };
  });

  const lastUndoable = undoable
    ? [...messages].reverse().find((m) => m.previousHtml !== undefined && !m.undone)
    : undefined;

  // Fait défiler l'historique jusqu'au dernier message. Page /lumeo : vers le début de la dernière
  // réponse, et seulement si l'utilisateur lisait la fin (jamais de saut pendant la lecture).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!page) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    const last = messages.at(-1);
    const action = lumeoScrollAction({ lastRole: last?.role ?? null, pending, nearBottom: nearBottomRef.current });
    const behavior: ScrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (action === "bottom") list.scrollTo({ top: list.scrollHeight, behavior });
    if (action === "reply") {
      const reply = list.querySelector<HTMLElement>(`[data-message-id="${last?.id}"]`);
      // La zone est « relative » : offsetTop est mesuré depuis son début.
      if (reply) list.scrollTo({ top: reply.offsetTop - 8, behavior });
    }
  }, [messages, pending, page]);

  function add(message: Omit<Message, "id">) {
    const id = store ? store.nextId() : localNextId.current++;
    setMessages((list) => [...list, { ...message, id }]);
  }

  async function send(text: string = input) {
    const request = text.trim();
    if (!request || pending || disabled) return;
    const history = messages.filter((m) => !m.error && !m.sorry).map(({ role, content }) => ({ role, content }));
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
        if (result.reply) add({ role: "assistant", content: result.reply, previousHtml, sorry: result.sorry });
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
  }, [opening, aiEnabled, setMessages]);

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
    <section
      aria-labelledby={titleId}
      className={
        panel
          ? "flex min-h-0 flex-1 flex-col gap-4 print:hidden"
          : `ui-card space-y-4 p-5 print:hidden ${fill ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""}`
      }
    >
      {persona === "lumeo" ? (
        <LumeoHeader id={titleId} tagline={tagline} expression={messages.length === 0 && !openingPending ? "salue" : "neutre"} />
      ) : minimal ? (
        <h2 id={titleId} className="sr-only">
          Coach
        </h2>
      ) : (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 id={titleId} className="font-semibold text-ink dark:text-white">
              Affiner avec l&apos;IA
            </h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">{texts.intro}</p>
          </div>
          {aiEnabled && (
            <p className="shrink-0 text-xs text-muted dark:text-slate-400">
              {usage.limit === null
                ? `${used} ${used > 1 ? units.many : units.one} ce mois-ci · sans quota mensuel`
                : `${Math.min(used, usage.limit)}/${usage.limit} ${units.many} ${units.used} ce mois-ci`}
            </p>
          )}
        </div>
      )}

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={persona === "lumeo" ? LUMEO_TEXTS.log : "Conversation avec l'assistant"}
        onScroll={page ? (e) => (nearBottomRef.current = isNearBottom(e.currentTarget)) : undefined}
        className={
          page
            ? "relative min-h-0 flex-1 space-y-6 overflow-y-auto px-1 py-2"
            : `${panel ? "min-h-0 flex-1" : fill ? "max-h-[75vh] min-h-[50vh] lg:max-h-none lg:min-h-0 lg:flex-1" : tall ? "max-h-[55vh] min-h-48" : "max-h-96 min-h-28"} space-y-3 overflow-y-auto rounded-block border border-line bg-surface p-3 dark:border-slate-700 dark:bg-slate-800/60`
        }
      >
        {messages.length === 0 && !pending && !openingPending && (
          <p className="py-6 text-center text-sm text-muted dark:text-slate-400">{texts.empty}</p>
        )}
        {openingPending && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted dark:text-slate-500">
            {persona === "lumeo" ? (
              <LumeoAvatar size={36} expression="reflechit" />
            ) : (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-accent dark:border-slate-300 dark:border-t-blue-600"
              />
            )}
            {persona === "lumeo" ? LUMEO_TEXTS.reading : "Lecture de ton CV…"}
          </p>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} data-message-id={message.id} className="flex justify-end">
              <p
                className={`max-w-[85%] bg-ink whitespace-pre-wrap text-white dark:bg-blue-600 ${
                  page ? "rounded-3xl rounded-br-md px-4 py-3 text-base leading-7" : "rounded-2xl rounded-br-sm px-3.5 py-2 text-sm"
                }`}
              >
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id} data-message-id={message.id} className={`flex items-start ${page ? "gap-3" : "gap-2"}`}>
              {persona === "lumeo" && <LumeoAvatar size={36} expression={assistantExpression(message)} />}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div
                className={`${persona === "lumeo" ? "max-w-[92%]" : "max-w-[85%]"} ${page ? "rounded-3xl rounded-tl-md" : "rounded-2xl rounded-bl-sm"} ring-1 ${
                  message.error
                    ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30"
                    : "bg-white text-ink ring-line dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                } ${
                  // Coach du CV Builder (markdown) : texte plus grand et bulle plus aérée.
                  page
                    ? "px-5 py-4 text-base leading-7"
                    : markdown && !message.error
                      ? "px-4 py-3 text-[15px] leading-relaxed"
                      : "px-3.5 py-2 text-sm whitespace-pre-wrap"
                }`}
              >
                {markdown && !message.error ? (
                  <ChatMarkdown text={message.content} links={links} spacious={page} />
                ) : (
                  message.content
                )}
              </div>
              {message.premium && <PremiumButton />}
              {message.undone ? (
                <span className="pl-1 text-xs text-muted dark:text-slate-500">Modification annulée.</span>
              ) : (
                message === lastUndoable &&
                !pending && (
                  <button
                    type="button"
                    onClick={() => undo(message)}
                    className="ui-focus ui-hit relative pl-1 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink dark:text-slate-500 dark:hover:text-slate-900"
                  >
                    Annuler cette modification
                  </button>
                )
              )}
              </div>
            </div>
          ),
        )}
        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted dark:text-slate-500">
            {persona === "lumeo" ? (
              <LumeoAvatar size={36} expression="reflechit" />
            ) : (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-accent dark:border-slate-300 dark:border-t-blue-600"
              />
            )}
            {texts.pending}
          </p>
        )}
      </div>

      {minimal ? null : !aiEnabled ? (
        <p className="text-xs text-muted dark:text-slate-500">Fonctionnalité non activée (clé API Claude manquante).</p>
      ) : limitReached && !panel ? (
        <UsageLimitBanner resetLabel={resetLabel} message={limitMessage} premiumBadge={limitMessage !== undefined} />
      ) : shownSuggestions.length === 0 || (panel && (messages.length > 0 || pending)) ? null : (
        <div className="flex flex-wrap gap-2">
          {shownSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => {
                // Panneau : la suggestion est posée telle quelle ; ailleurs, elle remplit le champ.
                if (panel) {
                  void send(suggestion);
                  return;
                }
                setInput(suggestion);
                inputRef.current?.focus();
              }}
              className="ui-focus ui-hit relative rounded-full bg-box px-3 py-1.5 text-xs font-medium text-prose transition hover:bg-[#E9E9EB] disabled:opacity-50 dark:border dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
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
        <label htmlFor={inputId} className="sr-only">
          {panel ? "Ta question" : "Ta demande"}
        </label>
        <textarea
          id={inputId}
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
          className="ui-input min-w-0 flex-1 resize-none py-2.5"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="ui-btn-primary"
        >
          {blocked ? LIMIT_REACHED_LABEL : pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
      {starter && aiEnabled && (
        <button
          type="button"
          // Après le premier message du coach, pour que sa réponse en tienne compte.
          disabled={disabled || pending || openingPending}
          onClick={() => void send(starter.message)}
          className="ui-focus ui-hit relative self-start text-xs font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
        >
          {starter.label}
        </button>
      )}
      {!minimal && (
        <p className="text-xs text-muted dark:text-slate-400">
          {texts.privacy}{" "}
          {usage.limit !== null && (
            <>
              {usage.limit} {usage.limit > 1 ? units.many : units.one} par mois avec le plan gratuit.{" "}
            </>
          )}
          {texts.save}
        </p>
      )}
    </section>
  );
}
