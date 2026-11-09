import "server-only";

import { normalizeAppUrl } from "./url-scheme";

/**
 * URL publique de l'app (liens des emails), sans « / » final. Toujours en https:// (schéma forcé
 * ou ajouté), sauf localhost en développement.
 */
export function appUrl() {
  if (process.env.APP_URL) return normalizeAppUrl(process.env.APP_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return "http://localhost:3000";
}
