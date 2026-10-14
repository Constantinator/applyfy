"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signupAction, type AuthFormState } from "@/app/actions/auth";
import { IconEye, IconEyeOff } from "@/components/icons";
import { PASSWORD_MAX_LENGTH, PASSWORD_RULES, isPasswordValid } from "@/lib/password";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";

import { FormError, inputClassName, submitClassName } from "./form-field";

const initialState: AuthFormState = { status: "idle" };

function RuleItem({ ok, touched, label }: { ok: boolean; touched: boolean; label: string }) {
  const color = ok ? "text-emerald-600" : touched ? "text-red-600" : "text-slate-500";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (state.status === "check-email") {
    return (
      <div role="status" className="space-y-3 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Vérifie ta boîte mail</h2>
        <p className="text-sm text-slate-600">
          Un lien de confirmation a été envoyé à <strong>{state.email}</strong>. Clique dessus pour
          activer ton compte et accéder à ton dashboard.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  const touched = password.length > 0;
  const tooLong = password.length > PASSWORD_MAX_LENGTH;
  const passwordOk = isPasswordValid(password);
  const canSubmit =
    passwordOk &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.length > 0 &&
    !pending;

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && <FormError message={state.message} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium text-slate-700">
            Prénom
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            maxLength={PERSON_NAME_MAX_LENGTH}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium text-slate-700">
            Nom
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            maxLength={PERSON_NAME_MAX_LENGTH}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

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
        {/* Bouton œil à la place d'un champ de confirmation : on vérifie ce qu'on a tapé. */}
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={touched && !passwordOk}
            aria-describedby="password-rules"
            className={`${inputClassName} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-controls="password"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
          </button>
        </div>
        <ul id="password-rules" aria-live="polite" className="space-y-1 pt-1">
          {PASSWORD_RULES.map((rule) => (
            <RuleItem key={rule.id} ok={rule.test(password)} touched={touched} label={rule.label} />
          ))}
          {tooLong && (
            <RuleItem ok={false} touched label={`${PASSWORD_MAX_LENGTH} caractères maximum`} />
          )}
        </ul>
      </div>

      <button type="submit" disabled={!canSubmit} className={submitClassName}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
