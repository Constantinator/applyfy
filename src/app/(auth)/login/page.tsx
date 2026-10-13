import type { Metadata } from "next";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = pageMetadata({
  title: "Connexion — Applyfy",
  description: "Connecte-toi à Applyfy pour retrouver tes candidatures, tes CV et tes rappels de relance.",
  path: "/login",
});

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erreur } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Content de te revoir !</p>
      {isSupabaseConfigured() && (
        <>
          <GoogleButton next={safeRedirectPath(next)} />
          <AuthDivider />
        </>
      )}
      <LoginForm
        next={safeRedirectPath(next)}
        notice={
          erreur === "lien"
            ? "Ce lien de confirmation est invalide ou a expiré. Connecte-toi ou recrée ton compte."
            : erreur === "google"
              ? "La connexion avec Google n'a pas abouti. Réessaie, ou utilise ton email et ton mot de passe."
              : undefined
        }
      />
    </>
  );
}
