"use client";

import { useState, useTransition } from "react";

import { saveAccountNameAction } from "@/app/actions/profile";
import { PERSON_NAME_MAX_LENGTH, type AccountName } from "@/lib/person-name";

export function AccountNameForm({ initial }: { initial: AccountName | null }) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = firstName.trim() !== (saved?.firstName ?? "") || lastName.trim() !== (saved?.lastName ?? "");

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveAccountNameAction(firstName, lastName);
      if (result.ok) {
        setSaved({ firstName: firstName.trim(), lastName: lastName.trim() });
        setFeedback({ ok: true, text: result.message });
      } else {
        setFeedback({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {!initial && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Renseigne ton prénom et ton nom : ils signent tes lettres de motivation.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="account-first-name" className="text-sm font-medium text-slate-700">
            Prénom
          </label>
          <input
            id="account-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={PERSON_NAME_MAX_LENGTH}
            autoComplete="given-name"
            className="input py-2"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="account-last-name" className="text-sm font-medium text-slate-700">
            Nom
          </label>
          <input
            id="account-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={PERSON_NAME_MAX_LENGTH}
            autoComplete="family-name"
            className="input py-2"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !firstName.trim() || !lastName.trim()}
          className="btn-primary px-4 py-2 text-sm"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {feedback && !pending && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`text-sm ${feedback.ok ? "text-emerald-700" : "text-red-600"}`}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
