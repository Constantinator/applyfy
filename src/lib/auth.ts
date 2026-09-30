import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient, isSupabaseConfigured } from "./supabase/server";

export type CurrentUser = { id: string; email: string | null };

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

  return { id: claims.sub, email: (claims.email as string | undefined) ?? null };
});

/**
 * À appeler avant tout accès aux données utilisateur (Server Components,
 * Server Actions, Route Handlers). Redirige vers /login si non connecté.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Chemin de redirection interne sûr (évite les redirections ouvertes vers un autre site). */
export function safeRedirectPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
