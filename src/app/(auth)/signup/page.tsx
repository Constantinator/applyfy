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
      <h1 className="mt-2.5 text-center text-[28px] leading-[1.15] font-bold tracking-[-0.03em] text-ink">Créer ton compte</h1>
      <p className="mt-1 mb-6 text-center text-[15px] text-muted">
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
