"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signupAction, type AuthFormState } from "@/app/actions/auth";
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

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  if (state.status === "check-email") {
    return (
      <div role="status" className="space-y-3 text-center">
        <p className="text-4xl" aria-hidden="true">
          📬
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Vérifie ta boîte mail</h2>
        <p className="text-sm text-slate-600">
          Un lien de confirmation a été envoyé à <strong>{state.email}</strong>. Clique dessus pour
          activer ton compte et accéder à ton dashboard.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  const touched = password.length > 0;
  const tooLong = password.length > PASSWORD_MAX_LENGTH;
  const passwordOk = isPasswordValid(password);
  const confirmationOk = confirmation.length > 0 && confirmation === password;
  const canSubmit = passwordOk && confirmationOk && email.length > 0 && !pending;

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && <FormError message={state.message} />}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </div>

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
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
