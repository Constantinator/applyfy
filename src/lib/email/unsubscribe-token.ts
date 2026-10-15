import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { appUrl } from "../app-url";

// Lien de désinscription one-click des emails. Token : « <jour>.<signature> », où la
// signature est un HMAC-SHA256 (UNSUBSCRIBE_SECRET) de l'id du compte et du jour d'émission
// (jours depuis l'epoch, UTC). Un lien reste valable un an : un vieil email marche encore.

const DAY_MS = 86_400_000;
const MAX_AGE_DAYS = 365;

export function isUnsubscribeConfigured() {
  return Boolean(process.env.UNSUBSCRIBE_SECRET);
}

function sign(userId: string, day: number) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET manquante.");
  return createHmac("sha256", secret).update(`unsubscribe:${userId}:${day}`).digest("base64url");
}

export function generateUnsubscribeToken(userId: string): string {
  const day = Math.floor(Date.now() / DAY_MS);
  return `${day}.${sign(userId, day)}`;
}

export function verifyUnsubscribeToken(token: string, userId: string): boolean {
  if (!isUnsubscribeConfigured()) return false;
  const match = /^(\d+)\.([\w-]+)$/.exec(token);
  if (!match) return false;
  const day = Number(match[1]);
  const today = Math.floor(Date.now() / DAY_MS);
  if (day > today || today - day > MAX_AGE_DAYS) return false;

  const expected = Buffer.from(sign(userId, day));
  const received = Buffer.from(match[2]);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Lien de désinscription d'un compte ; sans secret configuré, la page profil (repli). */
export function unsubscribeUrl(userId: string) {
  if (!isUnsubscribeConfigured()) return `${appUrl()}/profil`;
  const params = new URLSearchParams({ token: generateUnsubscribeToken(userId), uid: userId });
  return `${appUrl()}/api/unsubscribe?${params}`;
}

/** Le compte s'est désinscrit des emails (métadonnées Supabase). */
export function isUnsubscribed(metadata: Record<string, unknown> | null | undefined) {
  return typeof metadata?.emails_unsubscribed_at === "string";
}
