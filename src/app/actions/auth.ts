"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { PASSWORD_SET_FLAG, requireInvitedUser, safeRedirectPath } from "@/lib/auth";
import { PASSWORD_MAX_LENGTH, isPasswordValid } from "@/lib/password";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AuthFormState = { status: "idle" } | { status: "error"; message: string };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message: "Supabase n'est pas configuré : renseigne .env.local pour activer les comptes.",
};

function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirme d'abord ton adresse email via le lien reçu par mail.";
    case "weak_password":
      return "Ce mot de passe est trop faible, choisis-en un autre.";
    case "same_password":
      return "Choisis un mot de passe différent de l'actuel.";
    case "session_not_found":
    case "session_expired":
      return "Ton lien d'invitation a expiré. Demande une nouvelle invitation.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    default:
      return "Une erreur est survenue. Réessaie dans un instant.";
  }
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_PATTERN.test(email) || !password) {
    return { status: "error", message: "Renseigne ton email et ton mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: authErrorMessage(error) };

  redirect(safeRedirectPath(formData.get("next")));
}

/**
 * Activation d'un compte invité : l'invité est connecté via le lien d'invitation
 * et définit ici son mot de passe. Pas d'inscription publique (signUp) dans l'app.
 */
export async function activateAccountAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  await requireInvitedUser();

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  // Validation côté serveur : fait foi même si le formulaire est contourné.
  if (!isPasswordValid(password)) {
    return {
      status: "error",
      message:
        password.length > PASSWORD_MAX_LENGTH
          ? `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`
          : "Le mot de passe ne respecte pas toutes les règles.",
    };
  }
  if (password !== confirmation) {
    return { status: "error", message: "Les deux mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { [PASSWORD_SET_FLAG]: true },
  });
  if (error) return { status: "error", message: authErrorMessage(error) };

  // Réémet le JWT pour que le drapeau password_set soit visible immédiatement (proxy, DAL).
  await supabase.auth.refreshSession();

  redirect("/dashboard");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
