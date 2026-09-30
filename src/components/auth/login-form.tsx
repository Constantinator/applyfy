"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, type AuthFormState } from "@/app/actions/auth";

import { FormError, inputClassName, submitClassName } from "./form-field";

const initialState: AuthFormState = { status: "idle" };

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {state.status === "error" ? (
        <FormError message={state.message} />
      ) : (
        notice && <FormError message={notice} />
      )}

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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
      </div>

      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Pas encore de compte ?{" "}
        <Link href="/#liste-attente" className="font-medium text-indigo-600 hover:text-indigo-500">
          Rejoindre la liste d&apos;attente
        </Link>
      </p>
    </form>
  );
}
