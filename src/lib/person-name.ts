// Prénom et nom du compte : validation partagée entre formulaires (client) et actions (serveur).

export const PERSON_NAME_MAX_LENGTH = 50;

export type AccountName = { firstName: string; lastName: string };

/** Espaces normalisés ; null si vide, trop long ou contenant des caractères de balisage. */
export function cleanNamePart(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text || text.length > PERSON_NAME_MAX_LENGTH || /[<>{}\d]/.test(text)) return null;
  return text;
}

export function validateAccountName(
  firstName: unknown,
  lastName: unknown,
): { ok: true; name: AccountName } | { ok: false; error: string } {
  const first = cleanNamePart(firstName);
  if (!first) return { ok: false, error: "Indique ton prénom (sans chiffres, 50 caractères max)." };
  const last = cleanNamePart(lastName);
  if (!last) return { ok: false, error: "Indique ton nom (sans chiffres, 50 caractères max)." };
  return { ok: true, name: { firstName: first, lastName: last } };
}

/** Métadonnées Supabase Auth (user_metadata) → prénom et nom, ou null s'ils manquent. */
export function readAccountName(metadata: unknown): AccountName | null {
  const value = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
  const firstName = cleanNamePart(value.first_name);
  const lastName = cleanNamePart(value.last_name);
  return firstName && lastName ? { firstName, lastName } : null;
}

export const fullName = (name: AccountName) => `${name.firstName} ${name.lastName}`;
