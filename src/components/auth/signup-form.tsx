"use client";

import { useActionState, useState } from "react";

import { activateAccountAction, type AuthFormState } from "@/app/actions/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_RULES, isPasswordValid } from "@/lib/password";

import { FormError, inputClassName, submitClassName } from "./form-field";

const initialState: AuthFormState = { status: "idle" };

function RuleItem({ ok, touched, label }: { ok: boolean; touched: boolean; label: string }) {
  const color = ok ? "text-emerald-600" : touched ? "text-rose-600" : "text-slate-500";
  return (
    <li className={`flex items-center gap-2 text-sm ${color}`}>
      <span aria-hidden="true" className="w-4 text-center font-bold">
        {ok ? "✓" : "✗"}
      </span>
      <span>
        {label}
        <span className="sr-only">{ok ? " : validé" : " : non validé"}</span>
      </span>
    </li>
  );
}

/** Formulaire d'activation d'un compte invité : définition du mot de passe. */
export function SignupForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(activateAccountAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const touched = password.length > 0;
  const tooLong = password.length > PASSWORD_MAX_LENGTH;
  const passwordOk = isPasswordValid(password);
  const confirmationOk = confirmation.length > 0 && confirmation === password;
  const canSubmit = passwordOk && confirmationOk && !pending;

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && <FormError message={state.message} />}

      {email && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-700">Email</p>
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-slate-700 ring-1 ring-slate-200">
            {email}
          </p>
          {/* Aide les gestionnaires de mots de passe à associer le compte. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={touched && !passwordOk}
          aria-describedby="password-rules"
          className={inputClassName}
        />
        <ul id="password-rules" aria-live="polite" className="space-y-1 pt-1">
          {PASSWORD_RULES.map((rule) => (
            <RuleItem key={rule.id} ok={rule.test(password)} touched={touched} label={rule.label} />
          ))}
          {tooLong && (
            <RuleItem ok={false} touched label={`${PASSWORD_MAX_LENGTH} caractères maximum`} />
          )}
        </ul>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmation" className="text-sm font-medium text-slate-700">
          Confirmation du mot de passe
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          aria-invalid={confirmation.length > 0 && !confirmationOk}
          aria-describedby="confirmation-status"
          className={inputClassName}
        />
        <ul id="confirmation-status" aria-live="polite">
          <RuleItem
            ok={confirmationOk}
            touched={confirmation.length > 0}
            label="Les deux mots de passe correspondent"
          />
        </ul>
      </div>

      <button type="submit" disabled={!canSubmit} className={submitClassName}>
        {pending ? "Activation…" : "Activer mon compte"}
      </button>
    </form>
  );
}
