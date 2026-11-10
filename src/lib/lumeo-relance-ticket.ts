// Ticket « question déjà comptée » de « Améliorer ma relance » (lot 3a), côté serveur : signé
// quand le modèle propose « relance » dans le panneau, vérifié à la confirmation. Fichier séparé
// de lumeo-relance.ts pour que node:crypto n'entre jamais dans le code du navigateur.
import { createHmac, timingSafeEqual } from "node:crypto";

import { RELANCE_TICKET_TTL_MS } from "./lumeo-relance";

const ticketPayload = (userId: string, applicationId: string, issuedAt: number) =>
  `lumeo-relance:v1:${userId}:${applicationId.toLowerCase()}:${issuedAt}`;

/** Ticket signé par le serveur quand le modèle propose « relance » (question déjà comptée). */
export function signRelanceTicket(key: string, userId: string, applicationId: string, issuedAt = Date.now()): string {
  const mac = createHmac("sha256", key).update(ticketPayload(userId, applicationId, issuedAt)).digest("base64url");
  return `${issuedAt}.${mac}`;
}

/** Ticket valide : même utilisateur, même candidature, signé avec la clé, émis il y a moins de 3 min (RELANCE_TICKET_TTL_MS). */
export function verifyRelanceTicket(
  key: string | null,
  ticket: unknown,
  userId: string,
  applicationId: string,
  now = Date.now(),
): boolean {
  if (!key || typeof ticket !== "string") return false;
  const match = /^(\d{10,16})\.([A-Za-z0-9_-]{43})$/.exec(ticket);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 5_000 || now - issuedAt > RELANCE_TICKET_TTL_MS) return false;
  const expected = Buffer.from(signRelanceTicket(key, userId, applicationId, issuedAt).split(".")[1]);
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Clé des tickets : LUMEO_TICKET_SECRET si défini, sinon dérivée de la clé de service Supabase
 * (présente sur tous les environnements). Sans clé : pas de ticket, la confirmation est comptée
 * comme depuis la boîte (jamais gratuite par erreur).
 */
export function relanceTicketKey(env: Record<string, string | undefined> = process.env): string | null {
  if (env.LUMEO_TICKET_SECRET && env.LUMEO_TICKET_SECRET.length >= 32) return env.LUMEO_TICKET_SECRET;
  const base = env.SUPABASE_SERVICE_ROLE_KEY;
  return base ? createHmac("sha256", base).update("applyfy:lumeo-relance-ticket:v1").digest("base64url") : null;
}
