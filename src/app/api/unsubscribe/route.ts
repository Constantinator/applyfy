import { NextResponse, type NextRequest } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Lien de désinscription one-click des emails (?token=…&uid=…) : enregistre
// emails_unsubscribed_at dans les métadonnées du compte, puis affiche la confirmation.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const userId = searchParams.get("uid") ?? "";
  const failure = new URL("/unsubscribe/success?erreur=lien", request.url);

  if (!UUID.test(userId) || !verifyUnsubscribeToken(token, userId) || !isAdminConfigured()) {
    return NextResponse.redirect(failure);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return NextResponse.redirect(failure);

  // Déjà désinscrit : la date d'origine est conservée.
  if (typeof data.user.user_metadata?.emails_unsubscribed_at !== "string") {
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { emails_unsubscribed_at: new Date().toISOString() },
    });
    if (updateError) {
      console.error("[unsubscribe]", updateError);
      return NextResponse.redirect(failure);
    }
  }

  return NextResponse.redirect(new URL("/unsubscribe/success", request.url));
}
