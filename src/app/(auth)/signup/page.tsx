import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Créer un compte — Applyfy" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Créer ton compte</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Centralise toutes tes candidatures en quelques minutes.
      </p>
      <SignupForm />
    </>
  );
}
