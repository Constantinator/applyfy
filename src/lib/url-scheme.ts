// Normalisation de l'URL publique de l'app (liens des e-mails). Sans import : testable avec node --test.

const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

/**
 * URL sans « / » final, toujours en https:// sauf pour localhost (http:// accepté en local).
 * Ajoute le schéma s'il manque (« www.applyfy.fr » → « https://www.applyfy.fr »).
 */
export function normalizeAppUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, "");
  const match = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(value);
  const rest = match ? match[2] : value;
  if (LOCAL_HOST.test(rest)) return match ? value : `http://${rest}`;
  return `https://${rest}`;
}
