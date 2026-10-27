import knowledgeBase from "./cv-knowledge-base.json";
import { matchKeywords } from "./keyword-match";

// Base de connaissance CV par secteur (cv-knowledge-base.json) : détection du secteur du
// candidat et contexte sectoriel injecté dans le prompt du coach du CV Builder.

export const SECTORS = [
  "finance",
  "conseil",
  "tech",
  "marketing",
  "creatif",
  "commercial",
  "rh",
  "sante",
  "etudiant",
  "luxe",
] as const;
export type Sector = (typeof SECTORS)[number];

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
  ],
  conseil: [
    "consultant", "conseil", "consulting", "strategy", "strategie", "transformation", "mckinsey", "bcg",
    "bain", "roland berger", "oliver wyman", "accenture", "kearney", "capgemini invent",
  ],
  tech: [
    "developpeur", "developer", "dev ", "software", "logiciel", "ingenieur informatique", "full stack",
    "fullstack", "frontend", "front-end", "backend", "back-end", "devops", "data engineer", "data scientist",
    "machine learning", "cto", "tech lead", "sre", "cloud", "cybersecurite", "securite informatique",
    "architecte", "qa ", "mobile", "ios", "android", "python", "javascript", "java ",
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
    "Utilise ces éléments pour orienter tes questions et tes reformulations. Ce sont des repères : n'ajoute un mot-clé que s'il correspond à un fait réel du CV ou de la conversation.",
    "</secteur>",
  ]
    .filter(Boolean)
    .join("\n");
}
