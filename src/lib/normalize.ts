/**
 * Normalise le nom d'une entreprise : espaces superflus retirés, première lettre
 * en majuscule, reste en minuscule ("papernest", "PAPERNEST" → "Papernest").
 * Évite les doublons dus à la casse. Utilisé dans le formulaire et côté serveur.
 */
export function normalizeCompanyName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  // Array.from découpe par caractère Unicode (gère les accents et emojis en tête).
  const [first, ...rest] = Array.from(trimmed);
  return first.toLocaleUpperCase("fr-FR") + rest.join("").toLocaleLowerCase("fr-FR");
}
