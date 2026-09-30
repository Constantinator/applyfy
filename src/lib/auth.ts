import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient, isSupabaseConfigured } from "./supabase/server";

export type CurrentUser = { id: string; email: string | null; passwordSet: boolean };

/**
 * Drapeau posé dans user_metadata quand l'utilisateur a défini son mot de passe.
 * Les comptes sont créés sur invitation (Supabase invite) : l'invité arrive connecté
 * via le lien reçu par email, mais sans mot de passe tant qu'il n'est pas passé par /signup.
 */
export const PASSWORD_SET_FLAG = "password_set";

/**
 * Utilisateur connecté (JWT vérifié par Supabase), mémorisé pour la durée du rendu.
 * Retourne null si personne n'est connecté ou si Supabase n'est pas configuré (mode démo).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    passwordSet: claims.user_metadata?.[PASSWORD_SET_FLAG] === true,
  };
});

/**
 * À appeler avant tout accès aux données utilisateur (Server Components,
 * Server Actions, Route Handlers). Redirige vers /login si non connecté,
 * et vers /signup si l'invité n'a pas encore défini son mot de passe.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.passwordSet) redirect("/signup");
  return user;
}

/** Pour /signup : invité connecté via son lien, qui n'a pas encore de mot de passe. */
export async function requireInvitedUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/#liste-attente");
  if (user.passwordSet) redirect("/dashboard");
  return user;
}

/** Chemin de redirection interne sûr (évite les redirections ouvertes vers un autre site). */
export function safeRedirectPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
