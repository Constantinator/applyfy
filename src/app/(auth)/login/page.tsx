import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion — Applyfy" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erreur } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Content de te revoir !</p>
      <LoginForm
        next={safeRedirectPath(next)}
        notice={
          erreur === "lien"
            ? "Ce lien est invalide ou a expiré. Si c'était une invitation, demande-en une nouvelle."
            : undefined
        }
      />
    </>
  );
}
