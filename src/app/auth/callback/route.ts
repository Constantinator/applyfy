import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createExampleApplication } from "@/lib/example-application";
import { queueWelcomeEmail } from "@/lib/welcome-email";

// Retour de « Continuer avec Google » (OAuth Supabase, PKCE) : ?code=… échangé contre une
// session, puis /dashboard (ou la page demandée avant la connexion, ?next=…). Refus ou erreur
// chez Google (?error=…), ou échange impossible : /login?error=auth, avec un message.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const code = searchParams.get("code");

  let ok = false;
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth/callback] Google", error.message);
    ok = !error;
    // Première connexion Google = inscription : email de bienvenue (une seule fois).
    if (ok) {
      await queueWelcomeEmail(supabase, data.user);
      await createExampleApplication(supabase, data.user);
    }
  } else if (searchParams.get("error")) {
    console.error(
      "[auth/callback] Google",
      searchParams.get("error_description") ?? searchParams.get("error"),
    );
  }

  return NextResponse.redirect(new URL(ok ? next : "/login?error=auth", request.url));
}
