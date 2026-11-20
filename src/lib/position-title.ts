// Titre d'un poste tel qu'on l'écrit dans un message (relance, Lumeo) : sans « H/F », sans durée,
// avec le bon article. Fonctions pures ; le titre enregistré en base ne change jamais.

const DURATION = String.raw`\d+\s*(?:mois|ans?|semaines?)`;

/** Titre du poste sans « H/F », « (F/H) », « H/F/X », durée (« - 6 mois », « (6 mois) ») ni tirets en trop. */
export function cleanPosition(position: string): string {
  const cleaned = position
    .replace(/\(?\b[HFX]\s*\/\s*[HFX](?:\s*\/\s*[HFX])?\b\)?/gi, "")
    .replace(new RegExp(String.raw`\(\s*${DURATION}\s*\)`, "gi"), "")
    .replace(new RegExp(String.raw`\s*[-–—|]\s*${DURATION}\b`, "gi"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/(?:\s*[-–—|]\s*)+$/g, "")
    .replace(/^(?:\s*[-–—|]\s*)+/g, "")
    .replace(/\s+[-–—|]\s+(?:[-–—|]\s+)+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Inutilisable (aucune lettre, ex. « H/F » seul) : vide.
  return /\p{L}/u.test(cleaned) ? cleaned : "";
}

// ---------------------------------------------------------------------------
// Titre importé (lien, texte collé, extension, Trouver une offre) : bruit retiré une fois, à
// l'import. Jamais appliqué à un titre tapé à la main. Règle volontairement prudente : on ne
// retire que des morceaux entiers et reconnaissables, jamais un mot du métier.
// ---------------------------------------------------------------------------

/** Longueur maximale du titre d'origine gardé (colonne applications.position_original, migration 0042). */
export const POSITION_ORIGINAL_MAX = 300;

/** « H/F », « (F/H) », « H/F/X », « (F/H/NB) », « (f/m/d) », « (x/f/m) »… */
const GENDER_MARKER = /\(?\s*(?<![\p{L}\d])(?:[HFMWXD]|NB)(?:\s*\/\s*(?:[HFMWXD]|NB))+(?![\p{L}\d])\s*\)?/giu;
/** Séparateur de segments : tiret ou barre précédé ou suivi d'une espace (« Maître-nageur » reste entier). */
const SEPARATOR = /(\s+[-–—|]+\s*|\s*[-–—|]+\s+)/;
const DURATION_SEGMENT = /^\d+\s*(?:mois|ans?|semaines?|months?|weeks?)$/i;
const MONTH =
  "janv(?:ier)?|f[eé]v(?:rier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept?(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[eé]c(?:embre)?|january|february|march|april|may|june|july|august|september|october|november|december";
/** Date de début formant un segment à elle seule : « Janvier 2027 », « March 2027 », « Dès septembre 2027 ». */
const DATE_SEGMENT = new RegExp(String.raw`^(?:(?:d[ée]but|d[èe]s|start(?:ing)?|from)\s+)?(?:${MONTH})\.?\s+\d{4}$`, "i");
/** Code de département seul (France Travail : « 06 - Roquebrune-Cap-Martin »). */
const DEPARTMENT_CODE = /^(?:0[1-9]|[1-8]\d|9[0-5]|2[ab]|97[1-6])$/i;
/** Référence d'offre en fin de titre : « EC9536 », « Réf. 12345 ». */
const REFERENCE = /^(?:[A-Z]{1,5}[-_]?\d{3,}|[Rr][ée]f(?:[ée]rence)?\.?\s*:?\s*[\w-]+)$/u;

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-'’_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** « Paris 8 », « Paris 15e », « Marseille 11e Arrondissement » → « paris » ; codes postaux retirés. */
const placeName = (value: string) =>
  norm(value.replace(/^\s*\d{2,3}\s*-\s*/, "").replace(/\b\d{5}\b/g, ""))
    .replace(/\s*\b\d{1,2}\s*(?:e|er|eme|th)?(?:\s+arrondissement)?$/, "")
    .replace(/\s+arrondissement$/, "")
    .trim();

/** Grandes villes : retirées en fin de titre même quand le champ lieu dit autre chose (« Télétravail »). */
const MAJOR_CITIES = new Set(
  [
    "paris", "lyon", "marseille", "toulouse", "nice", "nantes", "montpellier", "strasbourg", "bordeaux",
    "lille", "rennes", "reims", "toulon", "grenoble", "dijon", "angers", "nimes", "aix en provence",
    "clermont ferrand", "le havre", "brest", "tours", "amiens", "limoges", "metz", "besancon",
    "perpignan", "orleans", "rouen", "caen", "nancy", "la defense", "boulogne billancourt",
    "issy les moulineaux", "levallois perret", "neuilly sur seine", "courbevoie", "puteaux",
    "nanterre", "montrouge", "saint denis",
  ],
);
const REGIONS_AND_COUNTRIES = new Set([
  "france", "fr", "ile de france", "idf", "auvergne rhone alpes", "provence alpes cote d azur", "paca",
  "occitanie", "nouvelle aquitaine", "hauts de france", "grand est", "bretagne", "normandie",
  "pays de la loire", "centre val de loire", "bourgogne franche comte", "corse",
]);
const OTHER = new Set(["autres", "autre", "other", "others"]);

function placesOf(location: string | null | undefined): Set<string> {
  const places = new Set<string>();
  for (const part of (location ?? "").replace(/^\s*\d{2,3}\s*-\s*/, "").split(/[,;()]/)) {
    const name = placeName(part);
    if (name.length >= 2) places.add(name);
  }
  return places;
}

const unwrap = (segment: string) => segment.trim().replace(/^\((.*)\)$/, "$1").trim();

/** Segment de fin qui ne dit que le lieu, le département, « Autres » ou la référence de l'offre. */
function isTrailingNoise(segment: string, places: Set<string>): boolean {
  const raw = unwrap(segment);
  if (DEPARTMENT_CODE.test(raw) || REFERENCE.test(raw) || OTHER.has(norm(raw))) return true;
  const parts = raw.split(",").map(placeName).filter(Boolean);
  return (
    parts.length > 0 &&
    parts.every((part) => places.has(part) || MAJOR_CITIES.has(part) || REGIONS_AND_COUNTRIES.has(part))
  );
}

const CONTRACT_WORDS = new Set([
  "STAGE", "STAGES", "STAGIAIRE", "INTERNSHIP", "INTERN", "ALTERNANCE", "ALTERNANT", "APPRENTISSAGE", "APPRENTI",
]);
const LOWERCASE_WORDS = new Set([
  "a", "au", "aux", "de", "des", "du", "d", "en", "et", "la", "le", "les", "l", "ou", "un", "une", "sur",
  "par", "pour", "avec", "sous", "chez", "dans", "of", "the", "and", "in", "for", "to", "at", "on", "or",
]);

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
const upperFirst = (text: string) => text.replace(/\p{L}/u, (letter) => letter.toUpperCase());

/** Titre presque tout en capitales (« STAGE - ASSISTANT(E) FINANCEMENTS STRUCTURES »). */
function isShouting(text: string) {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  return letters.length >= 10 && upper.length / letters.length > 0.7;
}

/**
 * Casse de phrase par segment ; les sigles restent en capitales (2-3 lettres hors petits mots,
 * mots avec chiffre ou « & » : PHP, DCM, M&A, BAC+4/5).
 */
function sentenceCase(segment: string) {
  const words = segment.split(/(\s+)/).map((word) => {
    const core = word.replace(/[^\p{L}]/gu, "");
    const keep =
      /[\d&]/.test(word) ||
      (core.length >= 2 && core.length <= 3 && word === word.toUpperCase() && !LOWERCASE_WORDS.has(core.toLowerCase()));
    return keep ? word : word.toLowerCase();
  });
  return upperFirst(words.join(""));
}

/**
 * Titre d'une offre importée débarrassé du bruit : « H/F », lieu, département, région, « Autres »,
 * référence, nom de l'entreprise en tête, durée et date de début formant un segment, capitales.
 * Le type de contrat (« Stage », « Alternance ») est gardé, en casse normale. Si le résultat
 * n'a plus au moins 3 lettres, le titre d'origine est rendu tel quel. Idempotente.
 */
export function tidyImportedTitle(
  title: string,
  context: { company?: string | null; location?: string | null } = {},
): string {
  const original = title.replace(/\s+/g, " ").trim();
  const inline = original
    .replace(GENDER_MARKER, " ")
    .replace(new RegExp(String.raw`\(\s*${DURATION}\s*\)`, "gi"), " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // [segment, séparateur, segment, …]
  const parts = inline.split(SEPARATOR);
  const segments = parts.filter((_, i) => i % 2 === 0).map((s) => s.trim());
  const separators = parts.filter((_, i) => i % 2 === 1).map((s) => s.trim().charAt(0));
  const kept = segments.map((segment) => {
    const raw = unwrap(segment);
    return /\p{L}|\d/u.test(raw) && !DURATION_SEGMENT.test(raw) && !DATE_SEGMENT.test(raw);
  });
  const alive = () => kept.flatMap((k, i) => (k ? [i] : []));

  // Fin du titre : lieu, département, région, « Autres », référence (jamais le premier segment).
  const places = placesOf(context.location);
  for (let list = alive(); list.length > 1 && isTrailingNoise(segments[list.at(-1)!], places); list = alive()) {
    kept[list.at(-1)!] = false;
  }
  // Début du titre : nom de l'entreprise répété (« VERT MARINE - Maître-nageur… »).
  const company = norm(context.company ?? "");
  const first = alive();
  if (company && first.length > 1 && norm(unwrap(segments[first[0]])) === company) kept[first[0]] = false;

  const indexes = alive();
  let result =
    indexes.length === segments.length
      ? inline.replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, "")
      : indexes.map((i, n) => (n === 0 ? segments[i] : ` ${separators[i - 1] || "-"} ${segments[i]}`)).join("");

  if (isShouting(result)) {
    const casedParts = result.split(SEPARATOR);
    result = casedParts.map((part, i) => (i % 2 === 0 ? sentenceCase(part) : part)).join("");
  } else {
    // « STAGE - Counterparty Risk Analyst » → « Stage - … » ; « stage Analyste… » → « Stage Analyste… ».
    result = result.replace(/\p{L}+/gu, (word) => (CONTRACT_WORDS.has(word) ? capitalize(word) : word));
    if (/^\p{Ll}+(?:\s|$)/u.test(result)) result = upperFirst(result);
  }

  result = result.replace(/\s{2,}/g, " ").trim();
  return (result.match(/\p{L}/gu)?.length ?? 0) >= 3 ? result : original;
}

/** « h » muet courant en début de métier (hôtesse, huissier, horloger, hébergement…). */
const H_MUET = /^h(?:ab|é|e(?:rb|ur)|ist|om|on|ô|or|ui|um|yd|yg|yp)/iu;
const VOWEL = /^[aeiouyàâäéèêëîïôöùûü]/iu;

/** Article devant le titre : « d' » devant voyelle (accentuée ou non) ou « h » muet, sinon « de ». */
export function positionArticle(title: string): "d'" | "de " {
  return VOWEL.test(title) || H_MUET.test(title) ? "d'" : "de ";
}

/** « au poste d'Analyste financier » / « au poste de Chargé de marketing » ; vide si titre inutilisable. */
export function atPosition(position: string): string {
  const title = cleanPosition(position);
  return title ? `au poste ${positionArticle(title)}${title}` : "";
}
