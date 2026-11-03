import type { Application } from "./types";

/** Texte comparable : minuscules, sans accents ni espaces superflus (« École » → « ecole »). */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** La candidature correspond-elle à la recherche (déjà normalisée) ? Poste ou entreprise. */
export function matchesSearch(app: Pick<Application, "company" | "position">, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return (
    normalizeSearch(app.company).includes(normalizedQuery) || normalizeSearch(app.position).includes(normalizedQuery)
  );
}
