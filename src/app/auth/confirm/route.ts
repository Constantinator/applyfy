import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Lien de confirmation d'email envoyé par Supabase après l'inscription.
// Gère les deux formats : ?code=… (PKCE, par défaut) et ?token_hash=…&type=… (template personnalisé).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const destination = ok ? next : "/login?erreur=lien";
  return NextResponse.redirect(new URL(destination, request.url));
}
