// Nettoyage des lieux bruts des pages carrières (« Madrid Office; Paris Office », « ARRAS, , France »,
// « Anywhere in France »…) en un libellé affichable : villes françaises au nom officiel, au plus 3,
// sinon « France » ou « Télétravail (France) ». Utilisé par la collecte seulement (job-collect.ts) :
// la table des communes embarquée (communes-fr.ts, ~430 Ko) ne doit jamais entrer dans une page ni
// un composant. Aucun appel réseau ici. Pas d'import propre à Next.js.
import { COMMUNE_NAMES, DEPARTMENT_NAMES, REGION_NAMES } from "./communes-fr";

/** Clé de comparaison : sans accents, casse, tirets ni apostrophes ; « St » = « Saint », « lez » = « lès ». */
export function foldPlace(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’\s]+/g, " ")
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte")
    .replace(/\blez\b/g, "les")
    .trim();
}

let communesByKey: Map<string, string[]> | null = null;

/**
 * Nom officiel de la commune (« EVREUX » → « Évreux »), ou null si elle est absente de la table.
 * Plusieurs communes de même clé (« Abbecourt », « Abbécourt ») : seulement si l'orthographe est exacte.
 */
export function officialCommuneName(name: string): string | null {
  if (!communesByKey) {
    communesByKey = new Map();
    for (const commune of COMMUNE_NAMES.split("\n")) {
      const key = foldPlace(commune);
      communesByKey.set(key, [...(communesByKey.get(key) ?? []), commune]);
    }
  }
  const spellings = communesByKey.get(foldPlace(name));
  if (!spellings) return null;
  return spellings.length === 1 ? spellings[0] : (spellings.find((spelling) => spelling === name) ?? null);
}

/** Régions et départements (noms officiels, anciennes régions et variantes vues dans les sources). */
const AREAS = new Set(
  [
    ...DEPARTMENT_NAMES,
    ...REGION_NAMES,
    "idf", "ile de france", "paca", "picardie", "bourgogne", "normandy", "brittany", "loire atlantique",
    "meurthe et moselle", "rhone", "aquitaine", "midi pyrenees", "languedoc roussillon", "alsace", "lorraine",
    "champagne ardenne", "nord pas de calais", "limousin", "poitou charentes", "auvergne", "rhone alpes",
    "franche comte", "haute normandie", "basse normandie", "centre", "corsica", "region parisienne", "grand paris",
    "hautes savoie", "provence", "cote d azur", "bas rhin", "haut rhin",
  ]
    .map(foldPlace)
    // Paris est aussi un département : c'est d'abord une ville.
    .filter((name) => name !== "paris"),
);

/** Lieux qui ne sont pas des communes : l'offre s'affiche alors « France ». */
const NOT_A_COMMUNE = /^(agglom[ée]ration|bassin|m[ée]tropole|communaut[ée])\b/i;
const NEIGHBOURHOODS = new Set(["les milles"]); // quartier d'Aix-en-Provence

const COUNTRY = /^(france|fr|france metropolitaine|france metropolitan|metropolitan france)$/;
const FOREIGN =
  /^(belgium|belgique|spain|espagne|germany|allemagne|united kingdom|uk|england|ireland|netherlands|the netherlands|portugal|italy|switzerland|suisse|luxembourg|united states|usa|us|canada|mexico|brazil|australia|singapore|india|china|japan|poland|austria|sweden|denmark|norway|finland|czech republic|romania|morocco|tunisia|europe|emea|european union)$/;
/** Grandes villes françaises : un morceau qui en contient une est en France, et elle y est la ville retenue. */
const FRANCE_CITY =
  /\baix\b|\bnancy\b|\bmetz\b|\brouen\b|\breims\b|\bdijon\b|\btours\b|\bangers\b|\bcaen\b|clermont|\bbrest\b|le mans|\bamiens\b|limoges|perpignan|orl[ée]ans|mulhouse|annecy|\bfrance\b|\bparis\b|\blyon\b|marseille|\blille\b|bordeaux|toulouse|nantes|\bnice\b|rennes|strasbourg|montpellier|grenoble|sophia|[iî]le[- ]de[- ]france|la d[ée]fense|boulogne|neuilly|levallois|issy/i;
const REMOTE = /\b(remote|t[ée]l[ée]travail|hybrid|hybride|anywhere|all france|full remote|work from home|wfh)\b/i;
const NOISE = /\b(offices?|hq|headquarters|si[eè]ge|campus)\b/gi;
const NOT_A_PLACE = /^(boutique|magasin|store|agence|site|usine|entrep[oô]t|centre commercial|cet|time zone)\b/i;
const PARTICLES = new Set(["sur", "sous", "en", "les", "lès", "lez", "de", "des", "du", "la", "le", "aux", "et"]);

/** Villes affichées au plus ; au-delà, « + n ». */
export const LOCATION_MAX_CITIES = 3;

/**
 * Règle 6 : casse rétablie (« BASSE-GOULAINE » → « Basse-Goulaine »), particules en minuscules sauf
 * en tête (« Villefranche sur Saône »), tirets et apostrophes gardés (« L'Isle Adam »).
 */
export function cityCase(name: string) {
  const upper = name === name.toUpperCase();
  let index = 0;
  return name.replace(/[\p{L}’']+/gu, (word) => {
    const first = index++ === 0;
    const lower = word.toLowerCase();
    if (!first && PARTICLES.has(lower)) return lower;
    const elision = /^([ld])['’](.+)$/i.exec(word);
    if (elision) {
      const [, letter, rest] = elision;
      const tail = upper ? rest.slice(1).toLowerCase() : rest.slice(1);
      return `${first ? letter.toUpperCase() : letter.toLowerCase()}'${rest.charAt(0).toUpperCase()}${tail}`;
    }
    return upper ? lower.charAt(0).toUpperCase() + lower.slice(1) : word.charAt(0).toUpperCase() + word.slice(1);
  });
}

type Piece = {
  city: string | null;
  /** Le morceau est en France (pays, région, département ou grande ville). */
  france: boolean;
  /** Le morceau nomme un pays (France ou autre) ou une zone. */
  explicit: boolean;
  /** La ville retenue figure dans la table des communes. */
  commune: boolean;
  remote: boolean;
};

const isArea = (folded: string) => AREAS.has(folded.replace(/^region /, "")) || NOT_A_COMMUNE.test(folded) || NEIGHBOURHOODS.has(folded);

/** Un morceau (« Paris, Île-de-France, France ») : ville, pays, télétravail. */
function parsePiece(piece: string): Piece {
  const remote = REMOTE.test(piece);
  const arrondissement = /arrondissement of (\p{L}[\p{L} -]*)/iu.exec(piece);
  const text = piece
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/gu, " ")
    .replace(/\b(anywhere|remote|based)\s+(in|from)\s+/gi, "")
    .replace(/\s+/g, " ");
  const parts = text
    .split(/\s*[,:]\s*|\s+[-–]\s*|\s*[-–]\s+/)
    .map((part) => part.replace(NOISE, " ").replace(REMOTE, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let france = false;
  let foreign = false;
  const kept: string[] = [];
  for (const part of parts) {
    const folded = foldPlace(part);
    // « Il de de France », « Région Île-de-France » : finissent par « france ».
    if (COUNTRY.test(folded) || /(^| )france$/.test(folded)) france = true;
    else if (FOREIGN.test(folded)) foreign = true;
    else if (isArea(folded)) france = true;
    else if (/^\d{2,5}$/.test(folded)) france = france || folded.length === 5; // département, code postal
    else if (NOT_A_PLACE.test(part) || /arrondissement/i.test(part)) continue;
    else
      kept.push(
        part
          .replace(/\s+\d{1,2}(e|er|ème)?$/i, "") // « Paris 8e »
          .replace(/\bSte\b\.?/gi, "Sainte")
          .replace(/\bSt\b\.?/gi, "Saint"),
      );
  }
  if (arrondissement) kept.push(arrondissement[1].trim());
  if (FRANCE_CITY.test(piece) && !foreign) france = true;

  // Règle 4 : une grande ville reconnue l'emporte, sinon le premier élément restant.
  const city = kept.find((part) => FRANCE_CITY.test(part) && !/france/i.test(part)) ?? kept[0] ?? null;
  return {
    city,
    france: france && !foreign,
    explicit: france || foreign,
    commune: city !== null && officialCommuneName(cityCase(city)) !== null,
    remote,
  };
}

export type CleanLocation = { label: string; cities: string[] };

/**
 * Règles 1 à 9 : libellé toujours non vide d'une offre en France (elle a passé le filtre de la
 * collecte). Les lieux bruts sont découpés sur « ; » et « or » ; seuls les morceaux en France sont
 * gardés (pays, région, grande ville, ou commune de la table) ; doublons retirés sans tenir compte
 * des accents, de la casse ni des tirets.
 */
export function cleanLocation(candidates: (string | null | undefined)[]): CleanLocation {
  const pieces = candidates
    .flatMap((value) => (value ?? "").split(/\s*;\s*|\s+or\s+/i))
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map(parsePiece);
  // Un seul lieu, sans pays : il est en France, puisque l'offre l'est.
  const single = new Set(pieces.map((piece) => piece.city && foldPlace(piece.city))).size <= 1;

  const cities: string[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    if (!piece.city || !(piece.france || (!piece.explicit && (single || piece.commune)))) continue;
    const cased = cityCase(piece.city);
    // Absente de la table : le nom nettoyé par la règle 6 est gardé.
    const name = officialCommuneName(cased) ?? cased;
    const key = foldPlace(name);
    if (seen.has(key) || COUNTRY.test(key)) continue;
    seen.add(key);
    cities.push(name);
  }

  if (!cities.length) return { label: pieces.some((piece) => piece.remote) ? "Télétravail (France)" : "France", cities };
  const label =
    cities.length > LOCATION_MAX_CITIES
      ? `${cities.slice(0, LOCATION_MAX_CITIES).join(", ")} + ${cities.length - LOCATION_MAX_CITIES}`
      : cities.join(", ");
  return { label, cities };
}
