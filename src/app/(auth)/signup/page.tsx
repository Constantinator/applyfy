import type { Metadata } from "next";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { pageMetadata } from "@/lib/seo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = pageMetadata({
  title: "Créer un compte — Applyfy",
  description: "Crée ton compte Applyfy gratuitement et organise ta recherche de stage ou d'emploi.",
  path: "/signup",
});

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Créer ton compte</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Centralise toutes tes candidatures en quelques minutes.
      </p>
      {isSupabaseConfigured() && (
        <>
          <GoogleButton />
          <AuthDivider />
        </>
      )}
      <SignupForm />
    </>
  );
}
