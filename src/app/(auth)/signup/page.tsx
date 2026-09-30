import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";
import { requireInvitedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Active ton compte — Applyfy" };

// Accessible uniquement via un lien d'invitation Supabase (voir /auth/confirm).
export default async function SignupPage() {
  const user = await requireInvitedUser();

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Bienvenue sur Applyfy 🎉</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Tu as été invité·e à rejoindre la bêta. Choisis ton mot de passe pour activer ton compte.
      </p>
      <SignupForm email={user.email} />
    </>
  );
}
