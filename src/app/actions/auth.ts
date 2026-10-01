"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

import { AccountDeletionError, deleteCurrentAccount } from "@/lib/account-deletion";
import { safeRedirectPath } from "@/lib/auth";
import { PASSWORD_MAX_LENGTH, isPasswordValid } from "@/lib/password";
import { validateAccountName } from "@/lib/person-name";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "check-email"; email: string };

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
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cet email. Connecte-toi.";
    case "signup_disabled":
      return "Les inscriptions sont momentanément fermées.";
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

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const name = validateAccountName(formData.get("firstName"), formData.get("lastName"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!name.ok) return { status: "error", message: name.error };
  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Entre une adresse email valide." };
  }
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

  // Les Server Actions sont toujours appelées avec un en-tête Origin (contrôle CSRF de Next.js).
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      // Prénom et nom dans les métadonnées du compte (cf. lib/account) : enregistrés même
      // si l'email doit encore être confirmé.
      data: { first_name: name.name.firstName, last_name: name.name.lastName },
    },
  });
  if (error) return { status: "error", message: authErrorMessage(error) };

  // Confirmation d'email désactivée dans Supabase : session ouverte, direction le dashboard.
  if (data.session) redirect("/dashboard");

  // Sinon, l'utilisateur doit cliquer sur le lien reçu par email (→ /auth/confirm → /dashboard).
  return { status: "check-email", email };
}

/** Supprime le compte connecté et toutes ses données, puis renvoie vers la page d'accueil. */
export async function deleteAccountAction(): Promise<{ error: string }> {
  try {
    await deleteCurrentAccount();
  } catch (error) {
    unstable_rethrow(error); // redirection vers /login si la session a expiré
    if (error instanceof AccountDeletionError) return { error: error.message };
    console.error("[deleteAccount]", error);
    return { error: "La suppression a échoué. Ton compte n'a pas été supprimé : réessaie dans un instant." };
  }
  redirect("/?compte=supprime");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
