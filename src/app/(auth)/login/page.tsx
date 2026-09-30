import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion — Applyfy" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erreur } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Content de te revoir !</p>
      <LoginForm
        next={safeRedirectPath(next)}
        notice={
          erreur === "lien"
            ? "Ce lien de confirmation est invalide ou a expiré. Connecte-toi ou recrée ton compte."
            : undefined
        }
      />
    </>
  );
}
