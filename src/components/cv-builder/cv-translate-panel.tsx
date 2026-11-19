"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { translateCvAction, type TranslateCvValue } from "@/app/actions/cv-builder";
import { AI_DAILY_LIMIT, type AiUsageCount } from "@/lib/ai-usage-limits";
import type { CvData, CvLang } from "@/lib/cv-builder-types";
import { TRANSLATION_TOO_SHORT, translationDirection } from "@/lib/cv-translation-language";

const TO_LABEL: Record<CvLang, string> = { fr: "en français", en: "en anglais" };
const LANG_NAME: Record<CvLang, string> = { fr: "français", en: "anglais" };

/** Langue du contenu indécidable : même texte que le refus du serveur. */
export const TOO_SHORT_MESSAGE = TRANSLATION_TOO_SHORT;

type State =
  | { step: "confirm" }
  | { step: "loading" }
  | { step: "done"; value: TranslateCvValue }
  | { step: "error"; message: string; limitReached: boolean };

/**
 * « Traduire en anglais / en français » (onglet Style) : bouton unique, langue tirée du CONTENU du
 * CV (jamais d'un réglage). Traduction SUR PLACE : confirmation (contenu remplacé, quota restant
 * pour un compte gratuit), chargement, puis résultat avec les champs gardés dans la langue
 * d'origine ; l'éditeur reprend le CV écrit par le serveur (onTranslated).
 */
export function CvTranslatePanel({
  cvId,
  title,
  data,
  usage,
  aiEnabled,
  application,
  beforeTranslate,
  onTranslated,
}: {
  cvId: string;
  title: string;
  /** Contenu affiché : sa langue décide le sens de la traduction. */
  data: CvData;
  /** Traductions du mois ; `limit` null : pas de quota mensuel (Premium, beta). */
  usage: AiUsageCount;
  aiEnabled: boolean;
  /** CV lié à une candidature : « Poste — Entreprise ». */
  application: { label: string } | null;
  /** Sauvegarde en attente envoyée et attendue avant la traduction ; false : pas enregistrée. */
  beforeTranslate: () => Promise<boolean>;
  /** CV traduit écrit en base (sans la photo) : l'éditeur remplace son contenu. */
  onTranslated: (value: TranslateCvValue) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<State>({ step: "confirm" });
  const direction = translationDirection(data);
  // Langue indécidable (CV trop court) : libellé par défaut, la fenêtre l'explique sans rien lancer.
  const to: CvLang = direction?.to ?? "en";
  const language: CvLang = direction?.from ?? "fr";
  const left = usage.limit === null ? null : Math.max(0, usage.limit - usage.used);

  const open = () => {
    setState({ step: "confirm" });
    dialogRef.current?.showModal();
  };
  const close = () => {
    if (state.step !== "loading") dialogRef.current?.close();
  };

  async function translate() {
    setState({ step: "loading" });
    // La traduction part du CV enregistré : la dernière modification affichée l'est d'abord.
    if (!(await beforeTranslate().catch(() => false))) {
      setState({ step: "error", message: "Ton CV n'a pas pu être enregistré juste avant la traduction : rien n'a été traduit ni décompté. Réessaie dans un instant.", limitReached: false });
      return;
    }
    const result = await translateCvAction(cvId, to).catch(() => null);
    if (!result) setState({ step: "error", message: "La traduction n'a pas abouti. Rien n'a été modifié ni décompté : réessaie dans un instant.", limitReached: false });
    else if (result.ok) {
      onTranslated(result.value);
      setState({ step: "done", value: result.value });
    }
    else setState({ step: "error", message: result.error, limitReached: Boolean(result.limitReached) });
  }

  return (
    <section aria-label="Traduction du CV" className="mt-6 border-t border-line-soft pt-5 dark:border-slate-700">
      <button type="button" onClick={open} disabled={!aiEnabled} className="ui-btn-secondary w-full">
        Traduire {TO_LABEL[to]}
      </button>
      <p className="mt-2 text-xs text-muted dark:text-slate-400">
        Remplace le contenu de ton CV par sa traduction {TO_LABEL[to]}.
        {left !== null && ` Traductions gratuites restantes ce mois : ${left} sur ${usage.limit}.`}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (state.step === "loading") event.preventDefault();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card p-0 backdrop:bg-slate-900/50 dark:bg-slate-900"
      >
        <div className="space-y-4 p-6 text-sm text-prose dark:text-slate-300">
          {(state.step === "confirm" || state.step === "loading") && (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
                Traduire « {title} » {TO_LABEL[to]} ?
              </h2>
              {!direction && (
                <p role="alert" className="ui-notice-error px-3 py-2">
                  {TOO_SHORT_MESSAGE}
                </p>
              )}
              <ul className="list-disc space-y-2 pl-5">
                <li>Le contenu de ton CV, en {LANG_NAME[language]}, est remplacé par sa traduction {TO_LABEL[to]}.</li>
                {application && <li>Ce CV reste celui de la candidature « {application.label} ».</li>}
                <li>
                  Les nombres, les noms propres, les diplômes et les dates sont gardés tels quels. Un texte dont la traduction n&apos;est pas
                  fiable reste {language === "fr" ? "en français" : "en anglais"}, et la liste t&apos;est donnée à la fin.
                </li>
                <li>
                  {left !== null
                    ? `Traductions gratuites restantes ce mois : ${left} sur ${usage.limit}. Une traduction n'est comptée que si ton CV traduit est enregistré.`
                    : `Pas de quota mensuel avec ton plan (dans la limite commune de ${AI_DAILY_LIMIT} actions IA par jour).`}
                </li>
              </ul>
              {state.step === "loading" && (
                <p role="status" className="font-medium text-ink dark:text-white">
                  Traduction en cours… Cela peut prendre jusqu&apos;à une minute, ne ferme pas cette page.
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" autoFocus onClick={close} disabled={state.step === "loading"} className="ui-btn-secondary">
                  Annuler
                </button>
                <button type="button" onClick={translate} disabled={state.step === "loading" || left === 0 || !direction} className="ui-btn-primary">
                  {state.step === "loading" ? "Traduction…" : `Traduire ${TO_LABEL[to]}`}
                </button>
              </div>
            </>
          )}

          {state.step === "done" && (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
                C&apos;est fait : ton CV est {TO_LABEL[state.value.language]}
              </h2>
              {state.value.kept.length ? (
                <div>
                  <p>
                    {state.value.kept.length > 1 ? `${state.value.kept.length} textes sont restés` : "1 texte est resté"} en {LANG_NAME[language]},
                    leur traduction n&apos;étant pas fiable. Tu peux les traduire toi-même en cliquant dessus dans l&apos;aperçu :
                  </p>
                  <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                    {state.value.kept.map((field) => (
                      <li key={field.label + field.text}>
                        <span className="font-medium">{field.label}</span> : « {field.text.length > 120 ? `${field.text.slice(0, 119)}…` : field.text} »
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>Tous les textes ont été traduits.</p>
              )}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className="ui-btn-primary">
                  Fermer
                </button>
              </div>
            </>
          )}

          {state.step === "error" && (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
                Traduction impossible
              </h2>
              <p role="alert">{state.message}</p>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className="ui-btn-secondary">
                  Fermer
                </button>
                {state.limitReached && (
                  <Link href="/premium" className="ui-btn-primary text-center">
                    Voir le Premium
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </dialog>
    </section>
  );
}
