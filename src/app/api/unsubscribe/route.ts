import { NextResponse, type NextRequest } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

// Lien de désinscription des e-mails (?token=…&uid=…), signé (HMAC, 365 jours).
// GET : redirige vers la page de confirmation /unsubscribe, sans rien écrire (les scanners de
// liens des messageries ouvrent les URL). POST : enregistre emails_unsubscribed_at dans les
// métadonnées du compte ; utilisé par le bouton de la page et par le one-click des messageries
// (en-tête List-Unsubscribe-Post, corps « List-Unsubscribe=One-Click », RFC 8058).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const target = new URL("/unsubscribe", request.url);
  for (const key of ["token", "uid"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 303);
}

/** Désinscrit le compte si le jeton est valide. La date d'origine est conservée. */
async function unsubscribe(userId: string, token: string) {
  if (!UUID.test(userId) || !verifyUnsubscribeToken(token, userId) || !isAdminConfigured()) return false;

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  if (typeof data.user.user_metadata?.emails_unsubscribed_at === "string") return true;

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { emails_unsubscribed_at: new Date().toISOString() },
  });
  if (updateError) {
    console.error("[unsubscribe]", updateError);
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ok = await unsubscribe(searchParams.get("uid") ?? "", searchParams.get("token") ?? "");

  const body = await request.text().catch(() => "");
  if (/List-Unsubscribe=One-Click/i.test(body)) {
    return new NextResponse(ok ? "Désinscription enregistrée." : "Lien invalide.", { status: ok ? 200 : 400 });
  }
  const destination = ok ? "/unsubscribe/success" : "/unsubscribe/success?erreur=lien";
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
