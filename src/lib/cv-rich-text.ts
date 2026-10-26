// Mise en forme dans les textes du CV Builder (barre d'outils de l'éditeur) : marquage
// léger, rendu par les modèles (aperçu et PDF).
//   **gras**   *italique*   __souligné__
// Pas d'imbrication : un passage a une seule mise en forme.

export type RichFormat = "bold" | "italic" | "underline";

export const RICH_MARKERS: Record<RichFormat, string> = { bold: "**", italic: "*", underline: "__" };

export type RichRun = { text: string; format: RichFormat | null };

// Italique : un seul astérisque, collé au texte des deux côtés (« * » isolé laissé tel quel).
const RICH_PATTERN = /\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s](?:[^*]*?[^*\s])?)\*/g;

/** Texte → passages avec leur mise en forme (un seul passage sans mise en forme si aucun marquage). */
export function parseRich(text: string): RichRun[] {
  const runs: RichRun[] = [];
  let last = 0;
  for (const match of text.matchAll(RICH_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ text: text.slice(last, index), format: null });
    if (match[1] !== undefined) runs.push({ text: match[1], format: "bold" });
    else if (match[2] !== undefined) runs.push({ text: match[2], format: "underline" });
    else runs.push({ text: match[3], format: "italic" });
    last = index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), format: null });
  return runs.length ? runs : [{ text, format: null }];
}

export function hasRich(text: string) {
  return parseRich(text).some((run) => run.format !== null);
}

/** Texte sans marquage (contexte de l'IA, comparaisons). */
export function stripRich(text: string) {
  return parseRich(text)
    .map((run) => run.text)
    .join("");
}

/**
 * Applique ou retire une mise en forme sur la sélection [start, end[ de `value`. Sans
 * sélection, rien ne change. Renvoie le nouveau texte et la nouvelle sélection.
 */
export function toggleRich(value: string, start: number, end: number, format: RichFormat) {
  const marker = RICH_MARKERS[format];
  if (end <= start) return { value, start, end };
  const selected = value.slice(start, end);

  // Sélection déjà entourée du marquage (à l'intérieur ou juste autour) : il est retiré.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
    const inner = selected.slice(marker.length, -marker.length);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  if (value.slice(start - marker.length, start) === marker && value.slice(end, end + marker.length) === marker) {
    return {
      value: value.slice(0, start - marker.length) + selected + value.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }

  // Espaces en bordure laissés hors du marquage (sinon il ne serait pas reconnu).
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  const core = selected.trim();
  if (!core) return { value, start, end };
  const wrapped = `${selected.slice(0, lead)}${marker}${core}${marker}${selected.slice(selected.length - trail)}`;
  return {
    value: value.slice(0, start) + wrapped + value.slice(end),
    start: start + lead,
    end: start + lead + core.length + marker.length * 2,
  };
}
