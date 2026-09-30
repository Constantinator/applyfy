"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveNotesAction } from "@/app/actions/applications";
import { NOTES_AUTOSAVE_DELAY_MS, NOTES_MAX_LENGTH } from "@/lib/application-details";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

type SaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

/** Hauteur d'une ligne du bloc-notes (texte et lignes du papier alignés). */
const LINE = "1.75rem";

/**
 * Notes libres de la candidature, enregistrées automatiquement 2 secondes après la
 * dernière frappe (et aussitôt quand le champ perd le focus).
 */
export function NotesPad({ applicationId, initialNotes }: { applicationId: string; initialNotes: string }) {
  const [value, setValue] = useState(initialNotes);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const valueRef = useRef(initialNotes);
  const savedRef = useRef(initialNotes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Numéro du dernier enregistrement lancé : ignore les réponses arrivées dans le désordre. */
  const lastRequest = useRef(0);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const text = valueRef.current;
    if (text === savedRef.current) {
      setStatus((s) => (s.kind === "pending" ? { kind: "idle" } : s));
      return;
    }
    const request = ++lastRequest.current;
    setStatus({ kind: "saving" });
    const result = await saveNotesAction(applicationId, text);
    if (request !== lastRequest.current) return;
    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    savedRef.current = text;
    // Frappe pendant l'enregistrement : un nouvel enregistrement est déjà programmé.
    setStatus(valueRef.current === text ? { kind: "saved", at: result.savedAt } : { kind: "pending" });
  }, [applicationId]);

  function onChange(next: string) {
    setValue(next);
    valueRef.current = next;
    setStatus({ kind: "pending" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, NOTES_AUTOSAVE_DELAY_MS);
  }

  // Avertit avant de quitter la page si des notes ne sont pas encore enregistrées.
  const unsaved = status.kind === "pending" || status.kind === "saving" || status.kind === "error";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const statusText =
    status.kind === "saving"
      ? "Enregistrement…"
      : status.kind === "pending"
        ? "Modifications en cours…"
        : status.kind === "saved"
          ? `Enregistré à ${timeFormatter.format(new Date(status.at))}`
          : status.kind === "error"
            ? status.message
            : "Enregistrement automatique";
  const nearLimit = value.length > NOTES_MAX_LENGTH * 0.9;

  return (
    <section aria-labelledby="notes-title" className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="notes-title" className="font-semibold text-slate-900">
          Notes
        </h2>
        <p
          aria-live="polite"
          className={`text-xs ${status.kind === "error" ? "font-medium text-red-600" : "text-slate-500"}`}
        >
          {statusText}
        </p>
      </div>
      <label htmlFor="application-notes" className="sr-only">
        Notes sur cette candidature
      </label>
      <textarea
        id="application-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (valueRef.current !== savedRef.current) void save();
        }}
        maxLength={NOTES_MAX_LENGTH}
        rows={8}
        spellCheck
        placeholder="Impressions après l'entretien, nom du recruteur, points à préparer…"
        className="block w-full resize-y border-0 bg-transparent px-1 text-[15px] text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
        style={{
          lineHeight: LINE,
          // Lignes du bloc-notes, alignées sur le texte et qui défilent avec lui.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${LINE} - 1px), rgb(253 230 138 / 0.7) calc(${LINE} - 1px), rgb(253 230 138 / 0.7) ${LINE})`,
          backgroundAttachment: "local",
        }}
      />
      {nearLimit && (
        <p className="mt-2 text-right text-xs text-amber-700">
          {value.length.toLocaleString("fr-FR")} / {NOTES_MAX_LENGTH.toLocaleString("fr-FR")} caractères
        </p>
      )}
    </section>
  );
}
