"use client";

import { useRef, useState, useTransition } from "react";

import { loadFeedbackAction, saveFeedbackAction } from "@/app/actions/feedback";
import { IconStar } from "@/components/icons";
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-8 w-8 ${filled ? "text-amber-400" : "text-slate-300"}`}>
      <path
        fill="currentColor"
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

const legend = "text-sm font-semibold text-slate-900";
const choice = (selected: boolean) =>
  `cursor-pointer rounded-xl px-3 py-2 text-sm ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
    selected ? "bg-blue-50 font-medium text-blue-700 ring-blue-300" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
  }`;

/**
 * « Donner mon avis » : bouton discret de la sidebar et fenêtre du questionnaire. Un seul
 * avis par utilisateur : à la réouverture, le formulaire reprend l'avis déjà donné.
 */
export function FeedbackDialog({ className = "" }: { className?: string }) {
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
      <button
        type="button"
        onClick={open}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 ${className}`}
      >
        <IconStar className="text-brand-cyan h-5 w-5" />
        Donner mon avis
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-0 shadow-2xl shadow-slate-900/20 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id="feedback-title" className="text-lg font-bold tracking-tight text-slate-900">
              Donner mon avis
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {hasExisting ? "Tu peux modifier ton avis à tout moment." : "1 minute pour nous aider à améliorer Applyfy."}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div className="space-y-4 px-6 py-8 text-center">
            <p className="text-3xl" aria-hidden="true">
              🙏
            </p>
            <p role="status" className="font-semibold text-slate-900">
              Merci pour ton avis !
            </p>
            <p className="text-sm text-slate-500">Il nous aide à choisir les prochaines améliorations.</p>
            <button type="button" onClick={close} className="btn-primary px-5 py-2.5 text-sm">
              Fermer
            </button>
          </div>
        ) : loading ? (
          <p role="status" className="px-6 py-10 text-center text-sm text-slate-500">
            Chargement…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-6 px-6 py-6">
            <fieldset>
              <legend className={legend}>Ta note globale</legend>
              <div className="mt-2 flex items-center gap-1">
                {STAR_LABELS.map((label, index) => {
                  const value = index + 1;
                  return (
                    <label key={value} className="cursor-pointer rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500">
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
                  <span className="ml-2 text-sm text-slate-500">{STAR_LABELS[draft.rating - 1]}</span>
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
                Ce qui manque <span className="font-normal text-slate-500">(plusieurs choix possibles)</span>
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
                Une chose à améliorer <span className="font-normal text-slate-500">(optionnel)</span>
              </label>
              <textarea
                id="feedback-improvement"
                value={draft.improvement}
                onChange={(e) => setDraft((d) => ({ ...d, improvement: e.target.value }))}
                maxLength={IMPROVEMENT_MAX_LENGTH}
                rows={3}
                placeholder="Ce qui te ferait gagner du temps, ce qui t'a gêné…"
                className="input mt-2"
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
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pending || !complete} className="btn-primary px-5 py-2.5 text-sm">
                {pending ? "Envoi…" : hasExisting ? "Mettre à jour mon avis" : "Envoyer mon avis"}
              </button>
              <button type="button" onClick={close} className="btn-secondary px-5 py-2.5 text-sm">
                Annuler
              </button>
              {!complete && (
                <p className="text-xs text-slate-500">Note, fonctionnalité préférée et recommandation requises.</p>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
