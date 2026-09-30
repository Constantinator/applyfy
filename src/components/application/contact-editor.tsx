"use client";

import { useRef, useState, useTransition } from "react";

import { updateContactAction } from "@/app/actions/applications";
import { CONTACT_NAME_MAX_LENGTH, EMAIL_PATTERN } from "@/lib/application-details";

type Contact = { name: string; email: string };

/**
 * Contact de la candidature (recruteur, RH…), modifiable en cliquant dessus.
 * Entrée ou sortie du champ : enregistre ; Échap : annule.
 */
export function ContactEditor({
  applicationId,
  initialName,
  initialEmail,
}: {
  applicationId: string;
  initialName: string | null;
  initialEmail: string | null;
}) {
  const [saved, setSaved] = useState<Contact>({ name: initialName ?? "", email: initialEmail ?? "" });
  const [draft, setDraft] = useState<Contact>(saved);
  const [editing, setEditing] = useState<false | "name" | "email">(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const groupRef = useRef<HTMLDivElement>(null);

  function startEditing(field: "name" | "email") {
    setDraft(saved);
    setError(null);
    setEditing(field);
  }

  function cancel() {
    setDraft(saved);
    setError(null);
    setEditing(false);
  }

  function commit() {
    const next = { name: draft.name.trim().replace(/\s+/g, " "), email: draft.email.trim().toLowerCase() };
    if (next.name === saved.name && next.email === saved.email) {
      cancel();
      return;
    }
    if (next.email && !EMAIL_PATTERN.test(next.email)) {
      setError("Adresse email invalide.");
      return;
    }
    startTransition(async () => {
      const result = await updateContactAction(applicationId, next);
      if (result.ok) {
        setSaved(next);
        setDraft(next);
        setError(null);
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (editing) {
    const inputClass = "input py-1.5 text-sm font-normal";
    return (
      <div
        ref={groupRef}
        className="space-y-2"
        // Enregistre quand le focus quitte le groupe (clic ailleurs, Tab après le dernier champ).
        onBlur={(e) => {
          if (!groupRef.current?.contains(e.relatedTarget as Node | null) && !pending) commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      >
        <label className="block">
          <span className="sr-only">Nom du contact</span>
          <input
            autoFocus={editing === "name"}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={CONTACT_NAME_MAX_LENGTH}
            placeholder="Nom (recruteur, RH…)"
            autoComplete="off"
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="sr-only">Email du contact</span>
          <input
            autoFocus={editing === "email"}
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            maxLength={254}
            placeholder="email@entreprise.com"
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(error)}
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs font-normal text-red-600">
            {error}
          </p>
        )}
        <p className="text-xs font-normal text-slate-500">
          {pending ? "Enregistrement…" : "Entrée pour enregistrer · Échap pour annuler"}
        </p>
      </div>
    );
  }

  const editable =
    "-mx-1.5 block max-w-full truncate rounded-md px-1.5 py-0.5 text-left transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none";
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => startEditing("name")}
        title="Cliquer pour modifier"
        className={`${editable} ${saved.name ? "text-slate-900" : "font-normal text-slate-400"}`}
      >
        {saved.name || "Ajouter un nom"}
      </button>
      <button
        type="button"
        onClick={() => startEditing("email")}
        title="Cliquer pour modifier"
        className={`${editable} font-normal ${saved.email ? "text-blue-600" : "text-slate-400"}`}
      >
        {saved.email || "Ajouter un email"}
      </button>
      {saved.email && (
        <a
          href={`mailto:${saved.email}`}
          className="inline-block text-xs font-normal text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Écrire un email ↗
        </a>
      )}
    </div>
  );
}
