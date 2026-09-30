import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Liens envoyés par Supabase Auth (invitation, etc.).
// Le template d'email "Invite user" doit pointer ici :
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// Le format ?code=… (PKCE) est aussi géré.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Un invité doit d'abord définir son mot de passe.
  const next = type === "invite" ? "/signup" : safeRedirectPath(searchParams.get("next"));

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
