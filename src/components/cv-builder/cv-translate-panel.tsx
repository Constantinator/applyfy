"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { translateCvAction, type TranslateCvValue } from "@/app/actions/cv-builder";
import { AI_DAILY_LIMIT, type AiUsageCount } from "@/lib/ai-usage-limits";
import { translatedCvTitle, type CvLang } from "@/lib/cv-builder-types";

const TO_LABEL: Record<CvLang, string> = { fr: "en français", en: "en anglais" };
const LANG_NAME: Record<CvLang, string> = { fr: "français", en: "anglais" };

type State =
  | { step: "confirm" }
  | { step: "loading" }
  | { step: "done"; value: TranslateCvValue }
  | { step: "error"; message: string; limitReached: boolean };

/**
 * « Traduire en anglais / en français » (onglet Style, sous la langue du CV) : confirmation
 * (quota restant pour un compte gratuit, copie créée, CV lié : la copie remplace l'original pour la
 * candidature), chargement, puis résultat avec les champs gardés dans la langue d'origine.
 */
export function CvTranslatePanel({
  cvId,
  title,
  language,
  usage,
  aiEnabled,
  application,
}: {
  cvId: string;
  title: string;
  /** Langue actuelle du CV : la copie est dans l'autre. */
  language: CvLang;
  /** Traductions du mois ; `limit` null : pas de quota mensuel (Premium, beta). */
  usage: AiUsageCount;
  aiEnabled: boolean;
  /** CV lié à une candidature : « Poste — Entreprise ». */
  application: { label: string } | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<State>({ step: "confirm" });
  const to: CvLang = language === "fr" ? "en" : "fr";
  const copyTitle = translatedCvTitle(title, to);
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
    const result = await translateCvAction(cvId).catch(() => null);
    if (!result) setState({ step: "error", message: "La traduction n'a pas abouti. Rien n'a été créé ni décompté : réessaie dans un instant.", limitReached: false });
    else if (result.ok) setState({ step: "done", value: result.value });
    else setState({ step: "error", message: result.error, limitReached: Boolean(result.limitReached) });
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={open} disabled={!aiEnabled} className="ui-btn-secondary w-full">
        Traduire {TO_LABEL[to]}
      </button>
      <p className="mt-2 text-xs text-muted dark:text-slate-400">
        Crée une copie traduite de ce CV ; ton CV actuel ne change pas.
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
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Une copie traduite, « {copyTitle} », est créée dans tes CV. Ton CV actuel reste tel quel, en {LANG_NAME[language]}.
                </li>
                {application && (
                  <li>
                    Ce CV est lié à la candidature « {application.label} » : la copie le remplace pour cette candidature. L&apos;original
                    reste dans tes CV, sans candidature.
                  </li>
                )}
                <li>
                  Les nombres, les noms propres, les diplômes et les dates sont gardés tels quels. Un texte dont la traduction n&apos;est pas
                  fiable reste {language === "fr" ? "en français" : "en anglais"}, et la liste t&apos;est donnée à la fin.
                </li>
                <li>
                  {left !== null
                    ? `Traductions gratuites restantes ce mois : ${left} sur ${usage.limit}. Une traduction n'est comptée que si la copie est créée.`
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
                <button type="button" onClick={translate} disabled={state.step === "loading" || left === 0} className="ui-btn-primary">
                  {state.step === "loading" ? "Traduction…" : `Traduire ${TO_LABEL[to]}`}
                </button>
              </div>
            </>
          )}

          {state.step === "done" && (
            <>
              <h2 id={titleId} className="text-lg font-semibold text-ink dark:text-white">
                C&apos;est fait : « {state.value.title} » est créé
              </h2>
              {state.value.link === "moved" && application && (
                <p>La copie est maintenant le CV de la candidature « {application.label} ». L&apos;original reste dans tes CV.</p>
              )}
              {state.value.link === "failed" && (
                <p role="alert" className="ui-notice-error px-3 py-2">
                  La copie n&apos;a pas pu être liée à la candidature : elle reste dans tes CV, sans candidature, et ton CV d&apos;origine
                  reste celui de la candidature.
                </p>
              )}
              {state.value.kept.length ? (
                <div>
                  <p>
                    {state.value.kept.length > 1 ? `${state.value.kept.length} textes sont restés` : "1 texte est resté"} en {LANG_NAME[language]},
                    leur traduction n&apos;étant pas fiable. Tu peux les traduire dans la copie en cliquant dessus :
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
                <button type="button" onClick={close} className="ui-btn-secondary">
                  Fermer
                </button>
                <Link href={`/cv-builder/${state.value.id}`} className="ui-btn-primary text-center">
                  Ouvrir la copie
                </Link>
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
    </div>
  );
}
