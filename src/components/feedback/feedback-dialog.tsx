"use client";

import { useImperativeHandle, useRef, useState, useTransition } from "react";

import { loadFeedbackAction, saveFeedbackAction } from "@/app/actions/feedback";
import {
  FAVORITE_FEATURES,
  IMPROVEMENT_MAX_LENGTH,
  MISSING_FEATURES,
  RECOMMEND_ANSWERS,
  type FavoriteFeature,
  type MissingFeature,
  type RecommendAnswer,
} from "@/lib/feedback-options";

type Draft = {
  rating: number;
  favoriteFeature: FavoriteFeature | null;
  missing: MissingFeature[];
  improvement: string;
  recommend: RecommendAnswer | null;
};

const EMPTY: Draft = { rating: 0, favoriteFeature: null, missing: [], improvement: "", recommend: null };

const STAR_LABELS = ["Très décevant", "Décevant", "Correct", "Bien", "Excellent"];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-8 w-8 ${filled ? "text-ink" : "text-line-strong"}`}>
      <path
        fill="currentColor"
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

const legend = "text-sm font-semibold text-ink dark:text-white";
const choice = (selected: boolean) =>
  `inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 py-1.5 text-sm ring-1 transition lg:min-h-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
    selected ? "bg-ink dark:bg-blue-500/15 font-medium text-white dark:text-blue-300 ring-ink" : "bg-white dark:bg-slate-900 text-ink dark:text-slate-200 ring-line dark:ring-slate-700 hover:bg-surface dark:hover:bg-slate-800"
  }`;

/**
 * « Donner mon avis » : fenêtre du questionnaire, ouverte par les entrées de la navigation
 * (via `ref`). Un seul avis par utilisateur : à la réouverture, le formulaire reprend l'avis
 * déjà donné.
 */
export type FeedbackDialogHandle = { open: () => void };

export function FeedbackDialog({ ref }: { ref?: React.Ref<FeedbackDialogHandle> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  async function open() {
    setError(null);
    setSent(false);
    setLoading(true);
    dialogRef.current?.showModal();
    const result = await loadFeedbackAction();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHasExisting(Boolean(result.feedback));
    setDraft(
      result.feedback
        ? { ...result.feedback, improvement: result.feedback.improvement ?? "" }
        : EMPTY,
    );
  }

  useImperativeHandle(ref, () => ({ open }));

  function close() {
    dialogRef.current?.close();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveFeedbackAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setHasExisting(true);
      setSent(true);
    });
  }

  const toggleMissing = (item: MissingFeature) =>
    setDraft((d) => ({
      ...d,
      missing: d.missing.includes(item) ? d.missing.filter((m) => m !== item) : [...d.missing, item],
    }));

  const complete = draft.rating > 0 && draft.favoriteFeature !== null && draft.recommend !== null;

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card border border-line bg-white dark:bg-slate-900 p-0 backdrop:bg-[rgba(10,10,10,0.45)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-7 sm:px-7">
          <div>
            <h2 id="feedback-title" className="text-[22px] font-bold tracking-[-0.03em] text-ink dark:text-white">
              Donner mon avis
            </h2>
            <p className="mt-0.5 text-sm text-muted dark:text-slate-400">
              {hasExisting ? "Tu peux modifier ton avis à tout moment." : "1 minute pour nous aider à améliorer Applyfy."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="ui-focus -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-pill dark:hover:bg-slate-800 hover:text-ink dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="space-y-4 px-6 py-8 text-center">
            <p className="text-3xl" aria-hidden="true">
              🙏
            </p>
            <p role="status" className="font-semibold text-ink dark:text-white">
              Merci pour ton avis !
            </p>
            <p className="text-sm text-muted dark:text-slate-400">Il nous aide à choisir les prochaines améliorations.</p>
            <button type="button" onClick={close} className="ui-btn-primary">
              Fermer
            </button>
          </div>
        ) : loading ? (
          <p role="status" className="px-6 py-10 text-center text-sm text-muted dark:text-slate-400">
            Chargement…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-6 px-5 pt-5 pb-7 sm:px-7">
            <fieldset>
              <legend className={legend}>Ta note globale</legend>
              <div className="mt-1 -ml-1.5 flex items-center">
                {STAR_LABELS.map((label, index) => {
                  const value = index + 1;
                  return (
                    <label key={value} className="cursor-pointer rounded-md p-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={draft.rating === value}
                        onChange={() => setDraft((d) => ({ ...d, rating: value }))}
                        className="sr-only"
                      />
                      <span className="sr-only">
                        {value} étoile{value > 1 ? "s" : ""} — {label}
                      </span>
                      <Star filled={value <= draft.rating} />
                    </label>
                  );
                })}
                {draft.rating > 0 && (
                  <span className="ml-2 text-sm text-muted dark:text-slate-400">{STAR_LABELS[draft.rating - 1]}</span>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend className={legend}>Ta fonctionnalité préférée</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(FAVORITE_FEATURES).map(([value, label]) => (
                  <label key={value} className={choice(draft.favoriteFeature === value)}>
                    <input
                      type="radio"
                      name="favorite"
                      value={value}
                      checked={draft.favoriteFeature === value}
                      onChange={() => setDraft((d) => ({ ...d, favoriteFeature: value as FavoriteFeature }))}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={legend}>
                Ce qui manque <span className="font-normal text-muted dark:text-slate-400">(plusieurs choix possibles)</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(MISSING_FEATURES).map(([value, label]) => {
                  const selected = draft.missing.includes(value as MissingFeature);
                  return (
                    <label key={value} className={choice(selected)}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMissing(value as MissingFeature)}
                        className="sr-only"
                      />
                      {selected ? "✓ " : ""}
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-improvement" className={legend}>
                Une chose à améliorer <span className="font-normal text-muted dark:text-slate-400">(optionnel)</span>
              </label>
              <textarea
                id="feedback-improvement"
                value={draft.improvement}
                onChange={(e) => setDraft((d) => ({ ...d, improvement: e.target.value }))}
                maxLength={IMPROVEMENT_MAX_LENGTH}
                rows={3}
                placeholder="Ce qui te ferait gagner du temps, ce qui t'a gêné…"
                className="ui-input mt-2"
              />
            </div>

            <fieldset>
              <legend className={legend}>Recommanderais-tu Applyfy à un·e ami·e ?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(RECOMMEND_ANSWERS).map(([value, label]) => (
                  <label key={value} className={choice(draft.recommend === value)}>
                    <input
                      type="radio"
                      name="recommend"
                      value={value}
                      checked={draft.recommend === value}
                      onChange={() => setDraft((d) => ({ ...d, recommend: value as RecommendAnswer }))}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="ui-notice-error px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pending || !complete} className="ui-btn-primary">
                {pending ? "Envoi…" : hasExisting ? "Mettre à jour mon avis" : "Envoyer mon avis"}
              </button>
              <button type="button" onClick={close} className="ui-btn-secondary">
                Annuler
              </button>
              {!complete && (
                <p className="text-xs text-muted dark:text-slate-400">Note, fonctionnalité préférée et recommandation requises.</p>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
