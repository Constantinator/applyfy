// Domaine du site d'une entreprise, pour afficher son logo (Logo.dev). Fonction pure, sans
// appel réseau : mieux vaut les initiales qu'un mauvais logo (plateforme, homonyme, agence).
//
// Ordre : (1) liste vérifiée à la main (job-boards.ts, ats-companies.json), (2) hôte de
// l'adresse de l'offre s'il n'est pas une plateforme, (3) domaine de l'e-mail du contact
// s'il n'est ni une messagerie ni une plateforme. Pour (2) et (3), le nom du domaine doit
// correspondre au nom de l'entreprise (contrôle de cohérence).

/**
 * Plateformes (sites d'emploi, logiciels de recrutement, cabinets, raccourcisseurs) : leur
 * domaine n'est jamais celui de l'entreprise. Comparaison sur le domaine principal EXACT
 * (tous ses sous-domaines compris), jamais sur une sous-chaîne : talent.com en est une,
 * talan.com non.
 */
export const PLATFORM_DOMAINS: ReadonlySet<string> = new Set([
  // Sites d'emploi
  "linkedin.com", "lnkd.in", "indeed.com", "indeed.fr", "welcometothejungle.com", "wttj.co",
  "hellowork.com", "francetravail.fr", "pole-emploi.fr", "jobteaser.com", "glassdoor.com",
  "glassdoor.fr", "apec.fr", "monster.com", "monster.fr", "cadremploi.fr", "meteojob.com",
  "regionsjob.com", "keljob.com", "talent.com", "jooble.org", "jobijoba.com", "optioncarriere.com",
  "adzuna.com", "adzuna.fr", "wellfound.com", "otta.com", "letudiant.fr", "studentjob.fr",
  "stepstone.fr", "jobs.ch", "join.com", "staffme.fr", "side.co",
  // Logiciels de recrutement (pages carrières hébergées)
  "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com",
  "teamtailor.com", "recruitee.com", "jobvite.com", "myworkdayjobs.com", "myworkdaysite.com",
  "workday.com", "icims.com", "taleo.net", "successfactors.com", "successfactors.eu",
  "breezy.hr", "bamboohr.com", "personio.de", "personio.com", "softgarden.io", "flatchr.io",
  "digitalrecruiters.com", "taleez.com", "welcomekit.co", "jobaffinity.fr", "beetween.com",
  "zohorecruit.com", "zohorecruit.eu", "pinpointhq.com", "rippling.com", "jazzhr.com",
  // Cabinets de recrutement et d'intérim : leur logo n'est pas celui de l'entreprise qui recrute
  "michaelpage.fr", "michaelpage.com", "pagepersonnel.fr", "hays.fr", "hays.com", "randstad.fr",
  "randstad.com", "adecco.fr", "adecco.com", "manpower.fr", "expectra.fr", "robertwalters.fr",
  "robertwalters.com", "roberthalf.com", "roberthalf.fr",
  "csod.com", "cornerstoneondemand.com", "oraclecloud.com", "avature.net", "phenompeople.com",
  "eightfold.ai", "talent-soft.com", "werecruit.io", "applytojob.com", "careers-page.com", "gupy.io",
  "jobs.lu", "jobup.ch",
  // Raccourcisseurs et pages de liens
  "bit.ly", "tinyurl.com", "t.co", "linktr.ee", "forms.gle",
  // Hébergements de fichiers et CDN (images d'un profil LinkedIn, pièces jointes…)
  "licdn.com", "cloudfront.net", "amazonaws.com", "googleusercontent.com",
  // Stockage Azure (*.blob.core.windows.net) : domaine principal windows.net, jamais le site d'une entreprise.
  "windows.net",
]);

/** Hôtes exacts de services génériques dont le domaine principal est une vraie entreprise (google.com). */
export const PLATFORM_HOSTS: ReadonlySet<string> = new Set([
  "docs.google.com", "drive.google.com", "sites.google.com", "forms.google.com",
  "forms.office.com", "onedrive.live.com", "notion.site", "hire.withgoogle.com",
]);

/** Messageries grand public : le domaine d'un e-mail de contact n'y dit rien de l'entreprise. */
export const WEBMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "hotmail.fr",
  "outlook.com", "outlook.fr", "live.com", "live.fr", "msn.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "gmx.com", "gmx.fr", "gmx.de", "protonmail.com", "proton.me", "pm.me", "orange.fr",
  "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr", "laposte.net", "bbox.fr", "numericable.fr",
  "mail.com", "yandex.com",
]);

/** Suffixes publics en deux parties : careers.example.co.uk → example.co.uk. */
const TWO_PART_SUFFIXES: ReadonlySet<string> = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "com.br", "com.ar",
  "com.mx", "com.tr", "com.cn", "com.hk", "com.sg", "com.tw", "co.jp", "ne.jp", "co.kr",
  "co.nz", "co.za", "co.in", "co.il", "com.es", "com.pt", "gouv.fr", "asso.fr", "com.pl",
]);

/** Formes juridiques retirées du nom, où qu'elles soient (« Qonto SAS » → « qonto »). */
const LEGAL_FORMS: ReadonlySet<string> = new Set([
  "sas", "sasu", "sa", "sarl", "sca", "snc", "eurl", "nv", "bv", "gmbh", "ag", "inc", "incorporated",
  "ltd", "limited", "llc", "plc", "corp", "spa", "srl",
]);

/**
 * Mots géographiques retirés seulement en fin de nom (« KPMG France » → « kpmg »), jamais en tête
 * (« France Travail »). group, groupe, holding(s), international, bank et banque ne sont JAMAIS
 * retirés : Fidelity International n'est pas Fidelity, Heritage Holdings n'est pas Heritage.
 */
const TRAILING_PLACES: ReadonlySet<string> = new Set(["france", "europe", "emea"]);

/** Après ces mots, le lieu fait partie du nom (« Banque de France », « Électricité de France »). */
const PLACE_PREPOSITIONS: ReadonlySet<string> = new Set(["de", "du", "des", "d"]);

/**
 * Mots trop génériques pour être un nom à eux seuls : le lieu qui les suit est gardé (« Air France »
 * n'est pas « Air », « Radio France » n'est pas « Radio »). Un sigle court reste traité comme avant
 * (« EY France » → « ey », « PwC France » → « pwc », « AXA France » → « axa »).
 */
const GENERIC_BEFORE_PLACE: ReadonlySet<string> = new Set(["air", "business", "radio", "atout", "campus"]);

/**
 * Mots du nom, normalisés : minuscules, sans accents, points d'abréviation supprimés
 * (« N.V. » → « nv »), autre ponctuation en espace, formes juridiques retirées, mots
 * géographiques retirés en fin de nom, sauf après une préposition (« Banque de France ») ou un
 * mot générique (« Air France »). Ne renvoie jamais une liste vide si le nom a des mots.
 */
export function nameTokens(name: string | null | undefined): string[] {
  const tokens = baseTokens(name);
  while (
    tokens.length > 1 &&
    TRAILING_PLACES.has(tokens[tokens.length - 1]) &&
    !PLACE_PREPOSITIONS.has(tokens[tokens.length - 2]) &&
    !(tokens.length === 2 && GENERIC_BEFORE_PLACE.has(tokens[0])) &&
    tokens.slice(0, -1).join("").length >= 2
  ) {
    tokens.pop();
  }
  return tokens;
}

/**
 * Clé calculée avant le lot 2b (lieu retiré même après une préposition ou un mot générique :
 * « Banque de France » → « banquede », « Air France » → « air »). Sert seulement à relire les lignes de company_domains écrites sous cette clé ;
 * une telle ligne n'est reprise que si son nom affiché donne la clé actuelle demandée.
 */
export function legacyNameKey(name: string | null | undefined): string {
  const tokens = baseTokens(name);
  while (tokens.length > 1 && TRAILING_PLACES.has(tokens[tokens.length - 1]) && tokens.slice(0, -1).join("").length >= 2) {
    tokens.pop();
  }
  return tokens.join("");
}

/** Mots normalisés, formes juridiques retirées (sans retrait du lieu). */
function baseTokens(name: string | null | undefined): string[] {
  const words = (name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const withoutLegal = words.filter((word) => !LEGAL_FORMS.has(word));
  return withoutLegal.length ? withoutLegal : words;
}

/** Noms de remplacement (offre sans entreprise) : jamais recherchés. */
export const PLACEHOLDER_NAME_KEYS: ReadonlySet<string> = new Set([
  "entreprisenoncommuniquee", "nonprecise", "confidentiel", "confidentielle",
]);

/** Clé de recherche d'une entreprise : « ING Bank N.V. France » → « ingbank », « Groupe Alpha » → « groupealpha ». */
export function nameKey(name: string | null | undefined): string {
  return nameTokens(name).join("");
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * Domaine principal d'un hôte (« careers.qonto.com » → « qonto.com »), ou null si l'hôte
 * n'est pas un nom de domaine public valide (adresse IP, localhost, caractères interdits).
 */
export function registrableDomain(host: string | null | undefined): string | null {
  const clean = (host ?? "").trim().toLowerCase().replace(/\.$/, "");
  const labels = clean.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return null;
  const tld = labels[labels.length - 1];
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return null;
  const size = TWO_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  if (labels.length < size) return null;
  return labels.slice(-size).join(".");
}

/** Hôte d'une adresse web http(s), ou null. */
function urlHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.hostname : null;
  } catch {
    return null;
  }
}

/** Plateforme : domaine principal dans la liste, ou hôte exact (docs.google.com, pas google.com). */
export function isPlatformHost(host: string): boolean {
  const clean = host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const domain = registrableDomain(clean);
  return PLATFORM_HOSTS.has(clean) || (domain !== null && PLATFORM_DOMAINS.has(domain));
}

/**
 * Cohérence nom/domaine : le nom du domaine sans extension (lettres et chiffres) contient le
 * nom normalisé de l'entreprise ou l'inverse, la partie contenue faisant au moins 3 caractères.
 */
export function domainMatchesName(domain: string, name: string | null | undefined): boolean {
  const key = nameKey(name);
  const label = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  const [short, long] = key.length <= label.length ? [key, label] : [label, key];
  return short.length >= 3 && long.includes(short);
}

export type CompanyDomainInput = {
  name: string | null | undefined;
  offerUrl?: string | null;
  contactEmail?: string | null;
};

/** Ligne de la table partagée company_domains (migration 0041), indexée par nameKey. */
export type SharedDomainRow = {
  domain: string | null;
  status: "verified" | "ambiguous" | "none" | "blocked";
  /** « admin » : domaine posé à la main (accepté même s'il figure dans les plateformes) ; « logo_dev_search »… */
  source?: string | null;
};

/**
 * Domaine fiable de l'entreprise, ou null (initiales, aucune requête vers Logo.dev). Ordre :
 * ligne « blocked » de la table (initiales, toujours) ; liste vérifiée à la main (`known`) ;
 * ligne « verified » de la table partagée (`shared`) ; puis déduction par l'adresse de l'offre ou
 * l'e-mail du contact, avec contrôle de cohérence, pour l'affichage de cette personne seulement
 * (jamais écrite dans la table).
 */
export function companyDomain(
  { name, offerUrl, contactEmail }: CompanyDomainInput,
  known: ReadonlyMap<string, string>,
  shared: ReadonlyMap<string, SharedDomainRow> = new Map(),
): string | null {
  const key = nameKey(name);
  if (!key) return null;
  const row = shared.get(key);
  if (row?.status === "blocked") return null;
  const listed = known.get(key);
  if (listed) return listed;
  if (row?.status === "verified" && row.domain) {
    const domain = registrableDomain(row.domain);
    // La liste des plateformes ne vise que les domaines trouvés automatiquement ou déduits :
    // une ligne posée à la main (source « admin », ex. Adecco → adecco.fr) est acceptée telle quelle.
    if (domain && (row.source === "admin" || !isPlatformHost(domain))) return domain;
  }

  const host = urlHost(offerUrl);
  if (host && !isPlatformHost(host)) {
    const domain = registrableDomain(host);
    if (domain && domainMatchesName(domain, name)) return domain;
  }

  const mailHost = contactEmail?.trim().toLowerCase().match(/^[^\s@]+@([^\s@]+)$/)?.[1];
  const mailDomain = registrableDomain(mailHost);
  if (mailHost && mailDomain && !WEBMAIL_DOMAINS.has(mailDomain) && !isPlatformHost(mailHost)) {
    if (domainMatchesName(mailDomain, name)) return mailDomain;
  }
  return null;
}

/**
 * Autres noms sûrs d'entreprises de la liste vérifiée (ancien nom, nom juridique, sigle
 * usuel) → nom de la liste. Seulement sans ambiguïté : pas « Mistral » (nom commun à
 * d'autres sociétés) ni « Vestiaire ». Les variantes d'écriture (« BackMarket »,
 * « Saint Gobain », « Mazars SA ») sont déjà couvertes par nameKey() ; « group » n'étant jamais
 * retiré, « Mazars Group » est un alias explicite.
 */
export const COMPANY_ALIASES: Readonly<Record<string, string>> = {
  Mazars: "Forvis Mazars",
  "Mazars Group": "Forvis Mazars",
  TGTG: "Too Good To Go",
  AccorHotels: "Accor",
  "Robert Bosch": "Bosch",
  "Younited Credit": "Younited",
  "Point72 Asset Management": "Point72",
  Sendinblue: "Brevo",
  "Vente-privee": "Veepee",
  "Vente-privee.com": "Veepee",
  "Eurofins Scientific": "Eurofins",
  "Sisley Paris": "Sisley",
  "Ubisoft Entertainment": "Ubisoft",
};

/**
 * Domaines vérifiés à la main pour des entreprises absentes de la liste : sigles trop courts pour
 * la recherche par nom, marques à sites par pays que la règle d'ambiguïté laisse en initiales
 * (lot 2c : Leroy Merlin). « BCG France » et « BCG » donnent la même clé (bcg), etc.
 */
export const EXPLICIT_DOMAINS: Readonly<Record<string, string>> = {
  "BCG France": "bcg.com",
  BCG: "bcg.com",
  "ING France": "ing.com",
  ING: "ing.com",
  "AXA France": "axa.fr",
  AXA: "axa.fr",
  // Lot 2d : clé « banquedefrance » (l'ancienne clé « banquede » reste lue dans la table).
  "Banque de France": "banque-france.fr",
  // Lot 2c (vérifiés : candidats Logo.dev, et réponse du site quand il ne bloque pas les robots).
  "Leroy Merlin": "leroymerlin.fr",
  "Leroy Merlin France": "leroymerlin.fr",
  "Crédit Agricole Personal Finance & Mobility": "ca-personalfinancemobility.com",
  "CA Personal Finance & Mobility": "ca-personalfinancemobility.com",
  WisdomTree: "wisdomtree.com",
  "WisdomTree UK": "wisdomtree.com",
};

/**
 * Domaines vérifiés complétés par les alias et les domaines explicites (jamais une entrée
 * existante écrasée).
 */
export function withAliases(known: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const all = new Map(known);
  for (const [name, domain] of Object.entries(EXPLICIT_DOMAINS)) {
    if (!all.has(nameKey(name))) all.set(nameKey(name), domain);
  }
  for (const [alias, official] of Object.entries(COMPANY_ALIASES)) {
    const domain = known.get(nameKey(official));
    if (domain && !all.has(nameKey(alias))) all.set(nameKey(alias), domain);
  }
  return all;
}

/** Origine du domaine d'une entreprise affichée, pour la mesure de couverture des logos. */
export type DomainOrigin = "liste" | "table" | "url" | "ambigu_none" | "inconnu" | "sans_nom";

/**
 * Même ordre que companyDomain : nom absent ou de remplacement, ligne « blocked », liste vérifiée,
 * ligne « verified » de la table, déduction par l'adresse de l'offre ; sinon ligne ambiguous / none
 * (ou domaine refusé), ou nom jamais cherché.
 */
export function domainOrigin(
  input: CompanyDomainInput,
  known: ReadonlyMap<string, string>,
  shared: ReadonlyMap<string, SharedDomainRow> = new Map(),
): DomainOrigin {
  const key = nameKey(input.name);
  if (key.length < 2 || PLACEHOLDER_NAME_KEYS.has(key)) return "sans_nom";
  const row = shared.get(key);
  if (row?.status === "blocked") return "ambigu_none";
  const domain = companyDomain(input, known, shared);
  if (domain && known.get(key) === domain) return "liste";
  if (domain && row?.status === "verified" && registrableDomain(row.domain) === domain) return "table";
  if (domain) return "url";
  return row ? "ambigu_none" : "inconnu";
}

/**
 * Ligne de journal de couverture des logos pour une page de résultats et une source :
 * « [offres] logos source=ft n=10 liste=… table=… url=… ambigu_none=… inconnu=… sans_nom=… ».
 * Seulement des nombres : jamais de nom d'entreprise.
 */
export function logoCoverageLine(
  source: string,
  offers: readonly { company: string | null | undefined; url?: string | null }[],
  known: ReadonlyMap<string, string>,
  shared: ReadonlyMap<string, SharedDomainRow>,
): string {
  const counts: Record<DomainOrigin, number> = { liste: 0, table: 0, url: 0, ambigu_none: 0, inconnu: 0, sans_nom: 0 };
  for (const offer of offers) counts[domainOrigin({ name: offer.company, offerUrl: offer.url }, known, shared)]++;
  const parts = (Object.keys(counts) as DomainOrigin[]).map((origin) => `${origin}=${counts[origin]}`);
  return `[offres] logos source=${source.replace(/[^a-z]/g, "")} n=${offers.length} ${parts.join(" ")}`;
}

/** Sources mesurées sur « Trouver une offre » et leur libellé dans le journal. */
const MEASURED_SOURCES = [["france-travail", "ft"], ["adzuna", "adzuna"]] as const;

/**
 * Journalise la couverture des logos d'une page de résultats : une ligne par source mesurée
 * présente sur la page (France Travail, Adzuna). Calcul en mémoire sur les données déjà lues ;
 * ne lève jamais d'exception (un échec donne une ligne d'erreur, la page s'affiche normalement).
 */
export function logLogoCoverage(
  offers: readonly { source: string; company: string | null | undefined; url?: string | null }[],
  known: ReadonlyMap<string, string>,
  shared: ReadonlyMap<string, SharedDomainRow>,
  log: (line: string) => void = console.log,
  logError: (line: string) => void = console.error,
): void {
  try {
    for (const [source, label] of MEASURED_SOURCES) {
      const page = offers.filter((offer) => offer.source === source);
      if (page.length > 0) log(logoCoverageLine(label, page, known, shared));
    }
  } catch (error) {
    logError(`[offres] logos : comptage impossible (${error instanceof Error ? error.name : "erreur"})`);
  }
}
