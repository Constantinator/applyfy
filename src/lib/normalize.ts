// Normalisation des noms d'entreprise, pour éviter les doublons dus à la casse
// (« papernest », « PAPERNEST » → « Papernest »). Utilisée dans le formulaire « Nouvelle
// candidature », côté serveur, et à l'ajout d'une offre depuis « Trouver une offre ».

/** Sigles et formes juridiques écrits en majuscules (comparés en minuscules). */
const ACRONYMS = new Set([
  // Banques, assurances, conseil
  "axa", "bnp", "bpce", "bred", "cic", "hsbc", "ing", "lcl", "ubs", "maif", "macif", "maaf", "gmf", "mma",
  "bcg", "kpmg", "ey", "bdo", "mbda",
  // Industrie, énergie, transport, télécoms, distribution
  "edf", "gdf", "rte", "sncf", "ratp", "ibm", "hp", "sap", "aws", "bmw", "seb", "lvmh", "sfr", "tf1",
  "psa", "ikea", "h&m", "c&a", "dhl", "ups", "tnt", "fnac", "ovh",
  // Organismes publics et internationaux
  "cnrs", "cea", "insee", "inrae", "inserm", "onu", "ocde", "ue", "bpi", "urssaf", "caf", "cpam", "rh",
  "bbc", "cnn", "nasa",
  // Formes juridiques
  "sa", "sas", "sasu", "sarl", "eurl", "sci", "snc", "se", "nv", "bv", "ag", "llc", "llp", "plc",
]);

/** Petits mots de liaison laissés en minuscules hors début de nom (« Banque de France »). */
const PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "sur", "aux", "au", "of", "and", "the", "for"]);

const capitalize = (word: string) => {
  const [first = "", ...rest] = Array.from(word);
  return first.toLocaleUpperCase("fr-FR") + rest.join("").toLocaleLowerCase("fr-FR");
};

const isAllUpper = (word: string) => word === word.toLocaleUpperCase("fr-FR") && word !== word.toLocaleLowerCase("fr-FR");
const isAllLower = (word: string) => word === word.toLocaleLowerCase("fr-FR");

/** Un mot (sans espace ni tiret), selon sa position dans le nom. */
function normalizeWord(word: string, first: boolean): string {
  const lower = word.toLocaleLowerCase("fr-FR");
  if (!/\p{L}/u.test(word)) return word; // « & », « 2026 »…

  // Sigle connu, ou sigle saisi en majuscules sans voyelle (« KPMG », « SNCF »).
  if (ACRONYMS.has(lower) || (isAllUpper(word) && word.length <= 5 && !/[aeiouyàâäéèêëîïôöùûü]/i.test(word))) {
    return word.toLocaleUpperCase("fr-FR");
  }
  // Abréviation à points : « n.v. », « s.a. » → « N.V. », « S.A. ».
  if (/^(\p{L}\.)+\p{L}?\.?$/u.test(word)) return word.toLocaleUpperCase("fr-FR");
  // Élision : « l'oréal » → « L'Oréal », « caisse d'épargne » → « Caisse d'Épargne ».
  const elision = word.match(/^([cdjlmnst])(['’])(.+)$/iu);
  if (elision) {
    const article = first ? elision[1].toLocaleUpperCase("fr-FR") : elision[1].toLocaleLowerCase("fr-FR");
    return `${article}${elision[2]}${normalizeWord(elision[3], true)}`;
  }
  if (!first && PARTICLES.has(lower)) return lower;
  // Casse mixte volontaire conservée (« BlaBlaCar », « eBay », « McDonald's »).
  if (!isAllLower(word) && !isAllUpper(word)) return word;
  return capitalize(word);
}

/**
 * Normalise le nom d'une entreprise : espaces superflus retirés, chaque mot avec une
 * majuscule initiale, sigles connus en majuscules, petits mots de liaison en minuscules.
 * Ex. « ing bank n.v. france » → « ING Bank N.V. France ».
 */
export function normalizeCompanyName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .split(" ")
    .map((token, index) =>
      // Mots composés (« coca-cola » → « Coca-Cola ») : chaque partie normalisée.
      token
        .split("-")
        .map((part, partIndex) => (part ? normalizeWord(part, index === 0 || partIndex > 0) : part))
        .join("-"),
    )
    .join(" ");
}
