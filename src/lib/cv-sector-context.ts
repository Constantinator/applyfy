import knowledgeBase from "./cv-knowledge-base.json";
import { matchKeywords } from "./keyword-match";

// Base de connaissance CV par secteur (cv-knowledge-base.json) : détection du secteur du
// candidat et contexte sectoriel injecté dans le prompt du coach du CV Builder.

// Liste des secteurs : source unique dans sectors.ts (réexportée ici pour les appels existants).
import { SECTORS, type Sector } from "./sectors";
import { isSector } from "./sectors";
export { SECTORS, type Sector };

export type SectorContext = {
  name: string;
  ats_keywords: string[];
  strong_action_verbs: string[];
  avoid: string[];
  bullet_examples: { bad: string; good: string; why: string }[];
  seniority_expectations: { junior: string; mid: string; senior: string };
  recruiter_tips: string[];
  common_mistakes: string[];
};

const KNOWLEDGE: Record<Sector, SectorContext> = knowledgeBase.sectors;

/** Mots (sans accents, minuscules) qui désignent un secteur dans un intitulé de poste. */
const TITLE_KEYWORDS: Record<Sector, string[]> = {
  finance: [
    "financ", "banque", "bancaire", "audit", "comptab", "controle de gestion", "controleur de gestion",
    "tresor", "m&a", "fusions", "private equity", "investment", "trader", "trading", "asset management",
    "gestion de patrimoine", "credit", "risk", "risques", "actuair", "fiscal", "cfo", "daf",
    // Finance de marché et banque d'investissement.
    "equity", "equities", "coverage", "debt capital markets", "equity capital markets", "capital markets",
    "marches de capitaux", "dcm", "ecm", "corporate finance", "investment banking", "banque d'investissement",
    "fixed income", "structured finance", "financements structures", "transaction services", "valuation",
    "front office", "middle office", "sales & trading", "lbo", "leveraged", "refinancement", "liquidite",
    "cash management", "gestion de fortune", "wealth", "private banking", "family office", "bank", "portfolio manager",
  ],
  conseil: [
    "consultant", "conseil", "consulting", "strateg", "transformation", "mckinsey", "bcg",
    "bain", "roland berger", "oliver wyman", "accenture", "kearney", "capgemini invent",
  ],
  tech: [
    "developpeur", "developer", "dev ", "software", "logiciel", "ingenieur informatique", "full stack",
    "fullstack", "frontend", "front-end", "backend", "back-end", "devops", "data engineer", "data scientist",
    "machine learning", "cto", "tech lead", "sre", "cloud", "cybersecurite", "securite informatique",
    "architecte", "qa ", "mobile", "ios", "android", "python", "javascript", "java ", "informatique",
  ],
  marketing: [
    "marketing", "communication", "seo", "sea", "growth", "brand", "marque", "community manager",
    "social media", "content", "contenu", "acquisition", "crm manager", "chef de produit marketing",
    "relations presse", "evenementiel",
  ],
  creatif: [
    "designer", "design", "graphiste", "directeur artistique", "direction artistique", "ux", "ui",
    "motion", "illustrat", "photographe", "video", "monteur", "creatif", "creative", "architecte d'interieur",
  ],
  commercial: [
    "commercial", "vente", "sales", "business developer", "business development", "account executive",
    "account manager", "key account", "sdr", "bdr", "charge d'affaires", "technico-commercial",
    "ingenieur d'affaires", "responsable grands comptes", "customer success",
  ],
  rh: [
    "ressources humaines", "rh", "hr", "recrut", "talent", "drh", "rrh", "hrbp", "paie",
    "gestion du personnel", "formation professionnelle", "people", "charge de recrutement",
  ],
  sante: [
    "medecin", "infirmi", "pharmac", "sante", "hopital", "hospitalier", "clinique", "soignant",
    "aide-soignant", "kine", "chirurg", "biolog", "medical", "dentiste", "sage-femme",
    "psycholog", "affaires reglementaires", "essais cliniques",
  ],
  etudiant: [
    "etudiant", "stage", "stagiaire", "alternance", "alternant", "apprenti", "jeune diplome", "junior",
    "master", "licence", "bachelor", "grande ecole", "cesure",
  ],
  luxe: [
    "luxe", "luxury", "fashion", "pret-a-porter", "retail", "boutique", "client advisor", "conseiller de vente",
    "maison", "joaillerie", "horlogerie", "parfum", "cosmetique", "lvmh", "kering", "hermes", "chanel",
    "dior", "visual merchandis",
  ],
};

/** Minuscules sans accents, pour comparer les mots-clés. */
function normalize(text: string) {
  return ` ${text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
}

function countMatches(text: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => {
    const k = normalize(keyword).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Début de mot obligatoire (« financ » trouve « finance », pas « refinancement ») ; mots
    // courts (rh, ux, sea…) : mot entier uniquement.
    const pattern = k.length <= 3 ? `[^a-z0-9]${k}[^a-z0-9]` : `[^a-z0-9]${k}`;
    return total + (new RegExp(pattern).test(text) ? 1 : 0);
  }, 0);
}

/**
 * Mots-clés ATS du secteur présents dans un texte (voir matchKeywords : mots ambigus en sens
 * métier, nom de l'entreprise et de ses produits exclus via `excluded`).
 */
export function matchSectorKeywords(text: string, sector: Sector, excluded: (string | null | undefined)[] = []): string[] {
  return matchKeywords(text, KNOWLEDGE[sector].ats_keywords, sector, excluded);
}

type CvShape = {
  personal?: { jobTitle?: unknown };
  experiences?: { position?: unknown; company?: unknown; bullets?: unknown }[];
  education?: unknown[];
};

/**
 * Secteur du candidat, d'après le poste visé et le titre du CV (poids fort), puis les
 * intitulés et entreprises des expériences. Sans indice, compte les mots-clés ATS de chaque
 * secteur dans tout le CV ; à défaut, « etudiant » (CV sans expérience ou peu renseigné).
 */
export function detectSector(cvJson: string, targetJob?: string | null): Sector {
  let cv: CvShape = {};
  try {
    cv = JSON.parse(cvJson) as CvShape;
  } catch {
    // CV illisible : seuls le poste visé et le texte brut comptent.
  }
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const experiences = Array.isArray(cv.experiences) ? cv.experiences : [];

  const titles = normalize([targetJob ?? "", str(cv.personal?.jobTitle)].join(" | "));
  const positions = normalize(experiences.map((e) => `${str(e.position)} | ${str(e.company)}`).join(" | "));

  const scores = SECTORS.map((sector) => ({
    sector,
    score: countMatches(titles, TITLE_KEYWORDS[sector]) * 3 + countMatches(positions, TITLE_KEYWORDS[sector]),
  }));
  // « etudiant » ne l'emporte que si aucun métier n'est reconnu (un stage en audit reste de la finance).
  const job = scores.filter((s) => s.sector !== "etudiant" && s.score > 0).sort((a, b) => b.score - a.score)[0];
  if (job) return job.sector;
  if (scores.some((s) => s.sector === "etudiant" && s.score > 0)) return "etudiant";

  const whole = normalize(cvJson);
  const byKeywords = SECTORS.filter((s) => s !== "etudiant")
    .map((sector) => ({ sector, score: countMatches(whole, KNOWLEDGE[sector].ats_keywords) }))
    .sort((a, b) => b.score - a.score)[0];
  return byKeywords.score >= 3 ? byKeywords.sector : "etudiant";
}

/**
 * Secteur d'une offre ou d'une candidature (titre du poste, puis description), ou null si rien
 * n'est reconnu : contrairement à detectSector, pas de repli « etudiant » (pas de faux secteur).
 */
export function detectOfferSector(title: string, description?: string | null): Sector | null {
  const titles = normalize(title);
  // Métiers d'abord : « stage » / « alternance » (etudiant) ne l'emporte jamais sur un métier reconnu.
  const jobs = SECTORS.filter((s) => s !== "etudiant")
    .map((sector) => ({ sector, score: countMatches(titles, TITLE_KEYWORDS[sector]) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (jobs.length) return uniqueTop(jobs, titles);
  if (countMatches(titles, TITLE_KEYWORDS.etudiant) > 0) return "etudiant";

  const whole = normalize(`${title} | ${description ?? ""}`);
  const byKeywords = SECTORS.filter((s) => s !== "etudiant")
    .map((sector) => ({ sector, score: countMatches(whole, KNOWLEDGE[sector].ats_keywords) }))
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score);
  return byKeywords.length ? uniqueTop(byKeywords) : null;
}

/** Offre d'un CV lié à une candidature : son secteur fixe celui du score (cvScoringSector). */
export type ScoringOffer = {
  position: string;
  company: string;
  description: string | null;
  /** Colonne applications.sector (migration 0038), sans contrainte en base : revalidée. */
  sector: string | null;
};

/**
 * Secteur du score d'un CV. CV lié à une candidature : secteur de l'offre (colonne
 * applications.sector, sinon détecté sur le poste et la description) ; à défaut, et en mode
 * libre (sans offre), secteur du CV (detectSector), comme avant.
 */
export function cvScoringSector(cvJson: string, targetJob: string | null | undefined, offer?: ScoringOffer | null): Sector {
  if (offer) {
    if (isSector(offer.sector)) return offer.sector;
    const fromOffer = detectOfferSector(offer.position, offer.description);
    if (fromOffer) return fromOffer;
  }
  return detectSector(cvJson, targetJob);
}

/** Candidature telle que lue en base (getApplicationDetail), réduite à ce qui sert au score. */
type OfferDetail = {
  application: {
    id: string;
    position?: string | null;
    company?: string | null;
    offer_description?: string | null;
    offer_summary?: string | null;
    sector?: string | null;
  };
};

/**
 * Offre qui fixe le secteur du score d'un CV : seulement la candidature à laquelle ce CV est lié.
 * Sans lien, sans candidature, ou candidature différente (appel incohérent) : null, donc mode libre.
 */
export function scoringOfferFor(applicationId: string | null | undefined, detail: OfferDetail | null | undefined): ScoringOffer | null {
  if (!applicationId || !detail || detail.application.id !== applicationId) return null;
  const app = detail.application;
  return {
    position: app.position ?? "",
    company: app.company ?? "",
    description: app.offer_description ?? app.offer_summary ?? null,
    sector: app.sector ?? null,
  };
}

/**
 * Titre du CV à aligner sur l'offre : son métier est reconnu et diffère du secteur de l'offre
 * (« Stage Transaction Services » pour une offre tech). Titre vide, non reconnu ou seulement
 * « étudiant » : rien à signaler.
 */
export function cvTitleMismatch(jobTitle: string, offerSector: Sector): boolean {
  const title = jobTitle.trim();
  // « Étudiant » n'est pas un métier : ni un titre « Stagiaire », ni une offre « Stage » sans métier reconnu.
  if (!title || offerSector === "etudiant") return false;
  const sector = detectOfferSector(title);
  return sector !== null && sector !== "etudiant" && sector !== offerSector;
}

/**
 * Départages d'une égalité au titre : un intitulé sans ambiguïté sur le métier l'emporte
 * (« Software Engineer, Display and Video » → tech ; « Sales Strategy » → commercial).
 */
const TIE_BREAKERS: [Sector, string[]][] = [
  ["tech", ["software engineer", "developer", "developpeur"]],
  ["commercial", ["sales", "sdr", "account executive"]],
];

/**
 * Secteur en tête, ou null en cas d'égalité (cas ambigu : « Autre » plutôt qu'un secteur deviné).
 * Seuls départages : TIE_BREAKERS, et seulement si un seul des secteurs à égalité s'y prête.
 */
function uniqueTop(sorted: { sector: Sector; score: number }[], title?: string): Sector | null {
  const tied = sorted.filter((s) => s.score === sorted[0].score).map((s) => s.sector);
  if (tied.length === 1) return tied[0];
  if (!title) return null;
  const winners = TIE_BREAKERS.filter(([sector, words]) => tied.includes(sector) && countMatches(title, words) > 0);
  return winners.length === 1 ? winners[0][0] : null;
}

/**
 * Verbes d'action de tous les secteurs : liste commune du score et de la vérification des puces
 * (une action reste une action quel que soit le secteur visé). Le prompt du coach garde ceux du secteur.
 */
export const COMMON_ACTION_VERBS: string[] = [...new Set(SECTORS.flatMap((s) => KNOWLEDGE[s].strong_action_verbs))];

/** Données du secteur dans la base de connaissance. */
export function getSectorContext(sector: Sector): SectorContext {
  return KNOWLEDGE[sector];
}

/**
 * Bloc du prompt du coach : secteur, 20 mots-clés ATS prioritaires (plus ceux relevés dans
 * les offres d'emploi récentes, s'il y en a), verbes d'action, expressions à éviter, un
 * exemple de reformulation (tiré au hasard) et 3 conseils recruteurs.
 */
export function formatSectorContext(context: SectorContext, marketKeywords: string[] = []): string {
  const example = context.bullet_examples[Math.floor(Math.random() * context.bullet_examples.length)];
  const known = new Set(context.ats_keywords.slice(0, 20).map((k) => normalize(k)));
  const market = marketKeywords.filter((k) => !known.has(normalize(k)));
  return [
    "<secteur>",
    `Secteur détecté : ${context.name}`,
    `Mots-clés ATS prioritaires : ${context.ats_keywords.slice(0, 20).join(", ")}`,
    market.length ? `Mots-clés fréquents dans les offres récentes du secteur : ${market.join(", ")}` : null,
    `Verbes d'action forts : ${context.strong_action_verbs.join(", ")}`,
    `Expressions à éviter : ${context.avoid.join(", ")}`,
    example
      ? `Exemple de reformulation :\n- Avant : ${example.bad}\n- Après : ${example.good}\n- Pourquoi : ${example.why}`
      : null,
    `Conseils recruteurs :\n${context.recruiter_tips.slice(0, 3).map((t) => `- ${t}`).join("\n")}`,
    "Utilise ces éléments pour orienter tes questions et tes reformulations. Ce sont des repères : n'ajoute ni ne suggère au candidat un mot-clé que s'il correspond à un fait réel du CV ou de la conversation.",
    "</secteur>",
  ]
    .filter(Boolean)
    .join("\n");
}
