import { z } from "zod";

// CV Builder : contenu d'un CV (colonne data de la table cv_builder, migration 0025) et
// modèles de mise en page. Partagé entre le serveur (validation à l'enregistrement) et
// l'éditeur (formulaire, prévisualisation, PDF).

export const CV_TEMPLATES = [
  { id: "minimaliste", name: "Minimaliste", description: "Noir et blanc, lignes fines. Idéal pour les ATS." },
  { id: "classique", name: "Classique", description: "En-tête centré, titres en majuscules." },
  { id: "moderne", name: "Moderne bleu", description: "Titres bleus, photo ronde, compétences sur 2 colonnes." },
  { id: "sidebar", name: "Sidebar sombre", description: "Colonne gauche sombre pour les infos et compétences." },
  { id: "tech", name: "Tech moderne", description: "Accent vert, badges, timeline et liens GitHub mis en avant." },
  { id: "finance", name: "Finance", description: "CV ATS classique : Times, noir et blanc, très compact." },
] as const;

export type CvTemplateId = (typeof CV_TEMPLATES)[number]["id"];
export const CV_TEMPLATE_IDS = CV_TEMPLATES.map((t) => t.id) as [CvTemplateId, ...CvTemplateId[]];

/**
 * Polices du CV, en 400 et 700 (public/fonts/cv, Google Fonts) : les mêmes fichiers servent
 * à l'aperçu et au PDF. Georgia n'est pas redistribuable : Gelasio a les mêmes proportions.
 */
export const CV_FONTS = [
  { id: "inter", name: "Inter", fallback: "sans-serif" },
  { id: "roboto", name: "Roboto", fallback: "sans-serif" },
  { id: "open-sans", name: "Open Sans", fallback: "sans-serif" },
  { id: "lato", name: "Lato", fallback: "sans-serif" },
  { id: "montserrat", name: "Montserrat", fallback: "sans-serif" },
  { id: "playfair-display", name: "Playfair Display", fallback: "serif" },
  { id: "merriweather", name: "Merriweather", fallback: "serif" },
  { id: "source-sans-3", name: "Source Sans Pro", fallback: "sans-serif" },
  { id: "raleway", name: "Raleway", fallback: "sans-serif" },
  { id: "gelasio", name: "Georgia (Gelasio)", fallback: "Georgia, serif" },
  // Tinos : mêmes proportions que Times New Roman et Liberation Serif (modèle Finance).
  { id: "tinos", name: "Times New Roman (Tinos)", fallback: "'Times New Roman', Times, serif" },
] as const;

export type CvFontId = (typeof CV_FONTS)[number]["id"];
const CV_FONT_IDS = CV_FONTS.map((f) => f.id) as [CvFontId, ...CvFontId[]];

/** Fichier d'une police dans public/. */
export function cvFontFile(id: CvFontId, weight: 400 | 700, italic = false) {
  return `/fonts/cv/${id}-${weight}${italic ? "-italic" : ""}.ttf`;
}

/** Couleur d'accent choisie dans « Style du CV » : #rrggbb. */
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Couleurs d'accent proposées (en plus du sélecteur libre). */
export const CV_ACCENT_PRESETS = [
  { value: "#111827", label: "Noir" },
  { value: "#1E3A5F", label: "Bleu marine" },
  { value: "#1E40AF", label: "Bleu" },
  { value: "#059669", label: "Vert" },
  { value: "#7F1D1D", label: "Bordeaux" },
  { value: "#4B5563", label: "Gris" },
] as const;

/** Taille du texte : facteur appliqué aux tailles et aux espacements verticaux des modèles. */
export const CV_DENSITIES = [
  { id: "compact", label: "Petite", factor: 0.88 },
  { id: "normal", label: "Normale", factor: 1 },
  { id: "large", label: "Grande", factor: 1.1 },
] as const;
export type CvDensity = (typeof CV_DENSITIES)[number]["id"];

export function densityFactor(density: CvDensity) {
  return CV_DENSITIES.find((d) => d.id === density)?.factor ?? 1;
}

export const SKILL_LEVELS = [
  { value: "", label: "Sans niveau" },
  { value: "debutant", label: "Débutant" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "avance", label: "Avancé" },
  { value: "expert", label: "Expert" },
] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number]["value"];

/** Niveau de compétence sur 4 (barres et points des modèles), 0 sans niveau. */
export function skillLevelValue(level: SkillLevel) {
  return ["", "debutant", "intermediaire", "avance", "expert"].indexOf(level);
}

/** Bornes : un CV tient sur 1 à 3 pages, la photo est redimensionnée dans le navigateur. */
/** « Importer un CV » : PDF ou Word, 5 Mo maximum. */
export const CV_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const CV_IMPORT_MAX_LABEL = "5 Mo";
/** Dossier du bucket « documents » où le navigateur dépose le fichier importé. */
export const CV_IMPORT_FOLDER = "cv-builder-import";

export const CV_LIMITS = {
  title: 120,
  /** Intitulés (poste, diplôme, école…) : un intitulé long ne doit jamais être coupé. */
  short: 300,
  url: 300,
  /** Prénom, nom, langue et son niveau. */
  name: 60,
  phone: 40,
  date: 40,
  /** Poste visé (score et coach). */
  targetJob: 120,
  interests: 500,
  text: 2000,
  bullet: 500,
  bullets: 12,
  skills: 40,
  items: 20,
  /** Photo en data URL (JPEG ~300 px) : ~50 Ko en pratique. */
  photo: 400_000,
};

const text = (max: number) => z.string().max(max).default("");
const id = z.string().min(1).max(40);

const ExperienceSchema = z.object({
  id,
  company: text(CV_LIMITS.short),
  position: text(CV_LIMITS.short),
  startDate: text(CV_LIMITS.date),
  endDate: text(CV_LIMITS.date),
  current: z.boolean().default(false),
  location: text(CV_LIMITS.short),
  bullets: z.array(z.string().max(CV_LIMITS.bullet)).max(CV_LIMITS.bullets).default([]),
});

const EducationSchema = z.object({
  id,
  school: text(CV_LIMITS.short),
  degree: text(CV_LIMITS.short),
  startDate: text(CV_LIMITS.date),
  endDate: text(CV_LIMITS.date),
  honors: text(CV_LIMITS.short),
  /** Cours suivis, classements… : puces sous la mention (absentes des CV plus anciens). */
  bullets: z.array(z.string().max(CV_LIMITS.bullet)).max(CV_LIMITS.bullets).default([]),
});

const SkillSchema = z.object({
  id,
  name: text(CV_LIMITS.short),
  level: z.enum(["", "debutant", "intermediaire", "avance", "expert"]).default(""),
});

const LanguageSchema = z.object({ id, name: text(CV_LIMITS.name), level: text(CV_LIMITS.name) });

const CertificationSchema = z.object({ id, name: text(CV_LIMITS.short), issuer: text(CV_LIMITS.short), date: text(CV_LIMITS.date) });

const ProjectSchema = z.object({
  id,
  name: text(CV_LIMITS.short),
  description: text(CV_LIMITS.text),
  link: text(CV_LIMITS.url),
});

/** Critères de l'analyse d'un CV importé, notés sur 10. */
export const CV_CRITERIA = [
  { id: "clarity", label: "Clarté" },
  { id: "impact", label: "Impact des formulations" },
  { id: "structure", label: "Structure" },
  { id: "ats", label: "Mots-clés ATS" },
  { id: "length", label: "Longueur" },
  { id: "formatting", label: "Mise en forme" },
] as const;
export type CvCriterionId = (typeof CV_CRITERIA)[number]["id"];

const note = (max: number) => z.number().int().min(0).max(max);

/**
 * Analyse faite à l'import d'un CV existant (même appel à l'IA que l'extraction) : score,
 * points forts et faibles, optimisations prioritaires (reprises par le chat de l'éditeur),
 * postes suggérés et poste visé choisi par l'utilisateur.
 */
export const CvAnalysisSchema = z.object({
  score: note(100),
  criteria: z.object({
    clarity: note(10),
    impact: note(10),
    structure: note(10),
    ats: note(10),
    length: note(10),
    formatting: note(10),
  }),
  positives: z.array(z.string().max(300)).max(6).default([]),
  improvements: z.array(z.string().max(300)).max(6).default([]),
  /** `request` : demande prête à envoyer au chat pour corriger ce point. */
  optimizations: z
    .array(z.object({ title: z.string().max(200), detail: z.string().max(500), request: z.string().max(200) }))
    .max(5)
    .default([]),
  suggestedJobs: z.array(z.string().max(80)).max(5).default([]),
  targetJob: z.string().max(120).default(""),
});
export type CvAnalysis = z.infer<typeof CvAnalysisSchema>;

export const CvDataSchema = z.object({
  personal: z
    .object({
      firstName: text(CV_LIMITS.name),
      lastName: text(CV_LIMITS.name),
      jobTitle: text(CV_LIMITS.short),
      email: text(CV_LIMITS.short),
      phone: text(CV_LIMITS.phone),
      city: text(CV_LIMITS.short),
      linkedin: text(CV_LIMITS.url),
      website: text(CV_LIMITS.url),
      github: text(CV_LIMITS.url),
      photo: z
        .string()
        .max(CV_LIMITS.photo)
        .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/)
        .nullable()
        .default(null),
    })
    .prefault({}),
  summary: text(CV_LIMITS.text),
  experiences: z.array(ExperienceSchema).max(CV_LIMITS.items).default([]),
  education: z.array(EducationSchema).max(CV_LIMITS.items).default([]),
  skills: z.array(SkillSchema).max(CV_LIMITS.skills).default([]),
  languages: z.array(LanguageSchema).max(CV_LIMITS.items).default([]),
  certifications: z.array(CertificationSchema).max(CV_LIMITS.items).default([]),
  projects: z.array(ProjectSchema).max(CV_LIMITS.items).default([]),
  interests: text(CV_LIMITS.interests),
  style: z
    .object({
      font: z.enum(CV_FONT_IDS).catch("inter").default("inter"),
      /** Texte compact : tailles et espacements verticaux réduits, pour tenir sur une page. */
      density: z.enum(["compact", "normal", "large"]).catch("normal").default("normal"),
      /** Alignement des paragraphes et des puces. */
      align: z.enum(["left", "justify"]).catch("left").default("left"),
      /** Couleur d'accent (#rrggbb) des titres, du nom et des traits ; vide : couleur du modèle. */
      accent: z.string().regex(ACCENT_PATTERN).or(z.literal("")).catch("").default(""),
    })
    .prefault({}),
  /** CV importé : analyse de l'import (null pour un CV créé à partir d'un modèle vierge). */
  analysis: CvAnalysisSchema.nullable().catch(null).default(null),
  /** Poste visé, saisi à la création « depuis zéro » (ou à la fin de l'import) : secteur du score et du coach. */
  targetJob: z.string().max(CV_LIMITS.targetJob).catch("").default(""),
  /** Origine du CV ; absente sur les CV créés avant ce champ (cf. cvOrigin). */
  origin: z.enum(["scratch", "import"]).optional().catch(undefined),
  /**
   * Premier message du coach (chat de l'éditeur), gardé tant que le contenu du CV ne change
   * pas : `contentKey` est l'empreinte du contenu (chatContent) au moment où il a été écrit.
   */
  coach: z
    .object({ opening: z.string().max(2000), contentKey: z.string().max(100) })
    .nullable()
    .catch(null)
    .default(null),
});

export type CvData = z.infer<typeof CvDataSchema>;
export type CvExperience = CvData["experiences"][number];
export type CvEducation = CvData["education"][number];
export type CvSkill = CvData["skills"][number];
export type CvLanguage = CvData["languages"][number];
export type CvCertification = CvData["certifications"][number];
export type CvProject = CvData["projects"][number];

export type BuilderCv = {
  id: string;
  title: string;
  templateId: CvTemplateId;
  data: CvData;
  /** Candidature à laquelle ce CV est lié (ouvert depuis sa fiche), sinon null. */
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuilderCvSummary = Omit<BuilderCv, "data" | "applicationId"> & { jobTitle: string };
/** Origine du CV : créé depuis zéro ou importé (CV antérieurs au champ : importé s'il a une analyse d'import). */
export function cvOrigin(data: CvData): "scratch" | "import" {
  return data.origin ?? (data.analysis ? "import" : "scratch");
}

/** Poste visé du CV : celui de la création, sinon celui choisi à la fin de l'import. */
export function targetJobOf(data: CvData): string {
  return data.targetJob.trim() || data.analysis?.targetJob.trim() || "";
}

/** Données d'un CV lues en base : jamais d'échec, seuls les champs invalides sont corrigés (cf. fitCvData). */
export function readCvData(value: unknown): CvData {
  return fitCvData(value).data;
}

export function isTemplateId(value: unknown): value is CvTemplateId {
  return CV_TEMPLATE_IDS.includes(value as CvTemplateId);
}

export function newItemId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Nom affiché : « Prénom Nom ». */
export function fullName(data: CvData) {
  return [data.personal.firstName, data.personal.lastName].filter((s) => s.trim()).join(" ");
}

/** « Sept. 2021 – Aujourd'hui », « 2019 – 2021 », ou une seule date. */
export function dateRange(start: string, end: string, current = false) {
  const to = current ? "Aujourd'hui" : end.trim();
  return [start.trim(), to].filter(Boolean).join(" – ");
}

/** Centres d'intérêt saisis séparés par des virgules. */
export function interestList(data: CvData) {
  return data.interests
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Adresse affichée sans « https:// » ni « www. ». */
export function displayUrl(url: string) {
  return url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/**
 * Modification faite dans l'aperçu : `path` désigne le champ ("personal.city",
 * "experiences.<id>.bullets.2"). Renvoie de nouvelles données, ou les mêmes si le chemin
 * ne correspond à rien.
 */
export function applyEdit(data: CvData, path: string, value: string): CvData {
  const keys = path.split(".");
  const set = (node: unknown, i: number): unknown => {
    const key = keys[i];
    const last = i === keys.length - 1;
    if (Array.isArray(node)) {
      const index = node.findIndex((item, j) =>
        item && typeof item === "object" && "id" in item ? item.id === key : String(j) === key,
      );
      if (index < 0) return node;
      const next = [...node];
      next[index] = last ? value : set(node[index], i + 1);
      return next;
    }
    if (node && typeof node === "object" && key in node) {
      const current = (node as Record<string, unknown>)[key];
      if (last && typeof current !== "string") return node;
      return { ...node, [key]: last ? value : set(current, i + 1) };
    }
    return node;
  };
  return set(data, 0) as CvData;
}

/** Texte du champ de ce chemin (cf. applyEdit), undefined s'il n'existe pas. */
export function readField(data: CvData, path: string): string | undefined {
  let node: unknown = data;
  for (const key of path.split(".")) {
    if (Array.isArray(node)) node = node.find((item, i) => (item && typeof item === "object" && "id" in item ? item.id === key : String(i) === key));
    else node = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
  }
  return typeof node === "string" ? node : undefined;
}

// Mots séparés par des blancs obligatoires : un long mot sans deux-points n'a qu'un seul découpage possible
// (sinon, des millions d'essais à chaque rendu, et la page gèle).
const SKILL_GROUP = /^(\s*[^\s:]+(?:\s+[^\s:]+){0,3}\s*:)(\s+\S[\s\S]*|\s*)$/;

/**
 * Compétence groupée, « Intitulé : a, b, c » (intitulé de 4 mots au plus) : intitulé avec ses deux
 * points, et le reste du texte, vide pour un intitulé seul (« Hard skills : », les compétences
 * suivantes sont alors dessous). null pour une compétence simple.
 */
export function splitSkillGroup(name: string) {
  const match = name.match(SKILL_GROUP);
  return match ? { label: match[1], items: match[2] } : null;
}

const BULLET_PATH = /^(experiences|education)\.([^.]+)\.bullets\.(\d+)$/;
const HONORS_PATH = /^education\.([^.]+)\.honors$/;
/** Élément d'une liste, désigné par son nom : Entrée crée l'élément suivant. */
const ITEM_NAME_PATH = /^(skills|languages|certifications|projects)\.([^.]+)\.name$/;
/** Autre texte d'un élément : Entrée crée l'élément suivant, sans couper le texte. */
const ITEM_DETAIL_PATH = /^(languages|certifications)\.([^.]+)\.(level|issuer)$/;
/** Intitulé d'une expérience ou d'une formation : Entrée ajoute une puce dessous, sans couper le texte. */
const HEADING_PATH = /^(?:experiences\.([^.]+)\.(?:position|company|location)|education\.([^.]+)\.(?:degree|school))$/;
const DESCRIPTION_PATH = /^projects\.([^.]+)\.description$/;
/** Ligne de l'onglet Contenu : dans l'aperçu, les centres d'intérêt sont un seul texte (« interests »). */
const INTEREST_PATH = /^interests\.(\d+)$/;

/**
 * Effet d'Entrée dans un champ, le même dans l'aperçu et dans l'onglet Contenu :
 * - `line` : coupe au curseur, la suite passe dans une nouvelle ligne de la liste ;
 * - `below` : le texte reste entier, nouvelle ligne vide dessous ;
 * - `newline` : paragraphe, saut de ligne dans le champ ;
 * - `validate` : champ court, la saisie se termine.
 */
export type EnterAction = "line" | "below" | "newline" | "validate";

export function enterAction(path: string): EnterAction {
  if (path === "summary" || path === "interests" || DESCRIPTION_PATH.test(path)) return "newline";
  if (BULLET_PATH.test(path) || HONORS_PATH.test(path) || ITEM_NAME_PATH.test(path) || INTEREST_PATH.test(path)) return "line";
  if (HEADING_PATH.test(path) || ITEM_DETAIL_PATH.test(path)) return "below";
  return "validate";
}

/** Ligne d'une liste : Retour arrière au début la recolle à la précédente. */
export const isLinePath = (path: string) => enterAction(path) === "line";

/**
 * Entrée sur une ligne vide : le curseur y reste, pour qu'un double appui n'empile pas de lignes. Sauf
 * dans une mention vide, qui n'est pas une ligne créée par Entrée : la première puce se crée dessous.
 */
export const keepsCaretOnBlank = (path: string) => !HONORS_PATH.test(path);

/** Retour arrière au début de ce champ : geste inverse d'Entrée (cf. mergeLine). */
export const hasLineMerge = (path: string) => isLinePath(path) || DESCRIPTION_PATH.test(path);

/** Nombre maximal de caractères du champ de ce chemin (cf. CvDataSchema), pour limiter la saisie. */
export function fieldLimit(path: string): number {
  const keys = path.split(".");
  const field = keys.at(-1) ?? "";
  if (path === "title") return CV_LIMITS.title;
  if (path === "targetJob") return CV_LIMITS.targetJob;
  if (keys[0] === "interests") return CV_LIMITS.interests;
  if (keys[0] === "personal") {
    if (field === "firstName" || field === "lastName") return CV_LIMITS.name;
    if (field === "phone") return CV_LIMITS.phone;
    if (field === "linkedin" || field === "website" || field === "github") return CV_LIMITS.url;
    return CV_LIMITS.short;
  }
  if (field === "summary") return CV_LIMITS.text;
  if (keys[0] === "languages") return CV_LIMITS.name;
  if (field === "startDate" || field === "endDate" || field === "date") return CV_LIMITS.date;
  if (field === "description") return CV_LIMITS.text;
  if (field === "link") return CV_LIMITS.url;
  if (keys.at(-2) === "bullets") return CV_LIMITS.bullet;
  return CV_LIMITS.short;
}

const SECTION_LABELS: Record<string, string> = {
  experiences: "Expérience",
  education: "Formation",
  skills: "Compétence",
  languages: "Langue",
  certifications: "Certification",
  projects: "Projet",
};
const FIELD_LABELS: Record<string, string> = {
  title: "Nom du CV",
  targetJob: "Poste visé",
  firstName: "Prénom",
  lastName: "Nom",
  jobTitle: "Titre du CV",
  email: "Email",
  phone: "Téléphone",
  city: "Ville",
  linkedin: "LinkedIn",
  website: "Site web",
  github: "GitHub",
  summary: "Accroche",
  interests: "Centres d'intérêt",
  position: "poste",
  company: "entreprise",
  location: "lieu",
  startDate: "date de début",
  endDate: "date de fin",
  school: "établissement",
  degree: "diplôme",
  honors: "mention",
  name: "nom",
  level: "niveau",
  issuer: "organisme",
  date: "date",
  description: "description",
  link: "lien",
};

/**
 * Nom lisible d'un champ du CV, d'après son chemin : « Formation 2 : mention », « Expérience 1 : puce 3 ».
 * Dans l'éditeur, les éléments sont désignés par leur id : « Formation : mention ».
 */
function fieldLabel(path: readonly PropertyKey[]): string {
  const [section, index, field, line] = path;
  if (section === "personal") return FIELD_LABELS[String(index)] ?? String(index);
  const name = SECTION_LABELS[String(section)];
  if (!name) return FIELD_LABELS[String(section)] ?? path.map(String).join(".");
  if (index === undefined) return name;
  const item = typeof index === "number" ? `${name} ${index + 1}` : name;
  if (field === "bullets") return line === undefined ? `${item} : puces` : `${item} : puce ${Number(line) + 1}`;
  return field === undefined ? item : `${item} : ${FIELD_LABELS[String(field)] ?? String(field)}`;
}

const tooLong = (label: string, max: number) => `Le champ « ${label} » est trop long, maximum ${max} caractères.`;

/** Message à la limite de caractères d'un champ de l'éditeur (cf. fieldLimit), ou à la limite `max` donnée. */
export const fieldLimitMessage = (path: string, max = fieldLimit(path)) => {
  const keys = path.split(".");
  return tooLong(keys[0] === "interests" ? FIELD_LABELS.interests : fieldLabel(keys), max);
};

const NEW_ITEM_NAMES: Record<string, string> = {
  skills: "Nouvelle compétence",
  languages: "Nouvelle langue",
  certifications: "Nouvelle certification",
  projects: "Nouveau projet",
};

/** Indication affichée dans un champ vide de l'aperçu. */
export function fieldPlaceholder(path: string) {
  const keys = path.split(".");
  return (keys[2] === "name" && NEW_ITEM_NAMES[keys[0]]) || (keys[2] === "bullets" ? "Nouvelle puce" : fieldLabel(keys));
}

/**
 * Premier champ refusé par CvDataSchema : son chemin (journal du serveur, sans le contenu du CV) et un
 * message pour l'utilisateur, ex. « Le champ « Formation 2 : mention » est trop long, maximum 300 caractères. »
 */
export function invalidCvField(error: z.ZodError): { path: string; message: string } {
  const issue = error.issues[0];
  const path = issue?.path ?? [];
  const label = fieldLabel(path);
  const tooMany = issue?.code === "too_big" && issue.origin === "array";
  const message =
    issue?.code === "too_big"
      ? tooMany
        ? `Le champ « ${label} » contient trop d'éléments, maximum ${issue.maximum}.`
        : tooLong(label, Number(issue.maximum))
      : `Le champ « ${label} » est invalide.`;
  return { path: path.map(String).join("."), message };
}

/** Élément sans contenu : texte vide, ou objet dont tous les textes sont vides (son id mis à part). */
function isEmptyEntry(entry: unknown): boolean {
  if (typeof entry === "string") return !entry.trim();
  if (!entry || typeof entry !== "object") return false;
  return Object.entries(entry).every(([key, value]) => key === "id" || (typeof value === "string" ? !value.trim() : Array.isArray(value) ? !value.length : !value));
}

/** Données impossibles à corriger (cf. fitCvData). */
export const CV_UNFIXABLE = "unfixable";

/** Correction d'un champ refusé, à annoncer à l'utilisateur. */
export type CvFix = { path: string; code: string; message: string };

/**
 * CV toujours valide, quelles que soient les données reçues : seuls les champs refusés par le schéma
 * sont corrigés (texte raccourci à sa limite, liste réduite, valeur invalide remise à zéro), jamais le
 * reste du CV. Dernier filet de sécurité : l'éditeur et le coach respectent déjà les limites.
 */
export function fitCvData(value: unknown): { data: CvData; fixes: CvFix[] } {
  const raw: unknown = value && typeof value === "object" ? structuredClone(value) : {};
  const fixes: CvFix[] = [];
  for (let pass = 0; pass < 5; pass++) {
    const parsed = CvDataSchema.safeParse(raw);
    if (parsed.success) return { data: parsed.data, fixes };
    // À l'envers : retirer un élément d'une liste ne décale pas les problèmes qui restent à traiter.
    for (const issue of [...parsed.error.issues].reverse()) {
      const keys = issue.path;
      const key = keys.at(-1);
      let owner = raw as Record<PropertyKey, unknown> | undefined;
      for (const k of keys.slice(0, -1)) owner = owner?.[k] as Record<PropertyKey, unknown> | undefined;
      if (!owner || key === undefined) continue;
      const current = owner[key];
      const label = fieldLabel(keys);
      const path = keys.map(String).join(".");
      if (issue.code === "too_big" && typeof current === "string") {
        owner[key] = current.slice(0, Number(issue.maximum));
        fixes.push({ path, code: issue.code, message: `${tooLong(label, Number(issue.maximum))} Seuls les ${issue.maximum} premiers caractères sont enregistrés : raccourcis-le pour garder ton texte.` });
      } else if (issue.code === "too_big" && Array.isArray(current)) {
        const filled = current.filter((entry) => !isEmptyEntry(entry));
        owner[key] = filled.slice(0, Number(issue.maximum));
        if (filled.length > Number(issue.maximum)) {
          fixes.push({ path, code: issue.code, message: `Le champ « ${label} » contient trop d'éléments, maximum ${issue.maximum} : les suivants ne sont pas enregistrés.` });
        }
      } else if (key === "id") {
        owner[key] = newItemId();
      } else {
        if (Array.isArray(owner)) owner.splice(Number(key), 1);
        else delete owner[key];
        fixes.push({ path, code: issue.code, message: `Le champ « ${label} » est invalide : il n'a pas été enregistré.` });
      }
    }
  }
  return { data: CvDataSchema.parse({}), fixes: [{ path: "", code: CV_UNFIXABLE, message: "Le CV contient des informations illisibles : il n'a pas été enregistré." }] };
}

const LIST_NAMES: Record<string, string> = {
  skills: `${CV_LIMITS.skills} compétences`,
  languages: `${CV_LIMITS.items} langues`,
  certifications: `${CV_LIMITS.items} certifications`,
  projects: `${CV_LIMITS.items} projets`,
};

/** Message affiché quand Entrée est bloquée dans cette liste. */
export const lineLimitMessage = (path: string) => {
  if (INTEREST_PATH.test(path)) return fieldLimitMessage(path);
  const list = LIST_NAMES[path.split(".")[0]];
  return `Maximum ${list ?? `${CV_LIMITS.bullets} puces`} atteint`;
};

/**
 * Liste avec une ligne ajoutée après celle d'`index`, et la position de cette nouvelle ligne. null
 * au nombre maximum de lignes remplies : les lignes vides ne comptent pas et sont retirées s'il
 * faut de la place (le schéma limite toute la liste). Une ligne vide déjà présente juste après est
 * réutilisée, pour ne pas accumuler de lignes vides cachées.
 */
function withLineAfter<T>(list: T[], index: number, current: T, added: T, isBlank: (item: T) => boolean, max: number) {
  if (isBlank(added) && index + 1 < list.length && isBlank(list[index + 1])) {
    return { list: list.map((item, i) => (i === index ? current : i === index + 1 ? added : item)), next: index + 1 };
  }
  if (list.filter((item) => !isBlank(item)).length >= max) return null;
  const others = (items: T[]) => (list.length >= max ? items.filter((item) => !isBlank(item)) : items);
  const head = others(list.slice(0, index));
  return { list: [...head, current, added, ...others(list.slice(index + 1))], next: head.length + 1 };
}

/** Expérience ou formation qui porte ces puces. */
function bulletOwner(data: CvData, section: string, id: string) {
  return section === "education" ? data.education.find((e) => e.id === id) : data.experiences.find((e) => e.id === id);
}

function withEducation(data: CvData, id: string, patch: Partial<CvEducation>): CvData {
  return { ...data, education: data.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

function withBullets(data: CvData, section: string, id: string, bullets: string[]): CvData {
  if (section === "education") return withEducation(data, id, { bullets });
  return { ...data, experiences: data.experiences.map((e) => (e.id === id ? { ...e, bullets } : e)) };
}

type NamedSection = "skills" | "languages" | "certifications" | "projects";
type NamedItem = { id: string; name: string };

/** Élément vide d'une liste, créé par Entrée. */
const NEW_ITEM: Record<NamedSection, (id: string) => NamedItem> = {
  skills: (id) => ({ id, name: "", level: "" }) as NamedItem,
  languages: (id) => ({ id, name: "", level: "" }) as NamedItem,
  certifications: (id) => ({ id, name: "", issuer: "", date: "" }) as NamedItem,
  projects: (id) => ({ id, name: "", description: "", link: "" }) as NamedItem,
};
const listMax = (section: NamedSection) => (section === "skills" ? CV_LIMITS.skills : CV_LIMITS.items);
/** Séparateur à la jonction de deux éléments recollés : ces listes s'écrivent avec des virgules. */
const ITEM_JOINT: Record<NamedSection, string> = { skills: ", ", languages: ", ", certifications: " ", projects: " " };
const itemsOf = (data: CvData, section: NamedSection) => data[section] as NamedItem[];
const withItems = (data: CvData, section: NamedSection, items: NamedItem[]) => ({ ...data, [section]: items }) as CvData;

/** Centres d'intérêt, un par ligne ; un texte sans retour à la ligne (CV importé) est lu séparé par des virgules. */
export function readInterests(text: string) {
  if (!text) return [];
  if (!text.trim()) return [""]; // une seule ligne, encore vide
  return text.includes("\n") ? text.split("\n") : text.split(",").map((s) => s.trim());
}

/** Texte enregistré pour ces lignes ; une seule ligne vide reste une ligne (cf. readInterests). */
export function writeInterests(lines: string[]) {
  return lines.length === 1 && !lines[0] ? "\n" : lines.join("\n");
}

/** Le CV avec une nouvelle ligne de liste, et le chemin de cette ligne. */
type LineSplit = { data: CvData; nextPath: string };

/** Puce vide ajoutée en tête des puces de cet élément : l'intitulé précède les puces. */
function firstBullet(data: CvData, section: string, id: string): LineSplit | null {
  const owner = bulletOwner(data, section, id);
  if (!owner) return null;
  const split = withLineAfter(["intitulé", ...owner.bullets], 0, "intitulé", "", (line) => !line.trim(), CV_LIMITS.bullets + 1);
  return split && { data: withBullets(data, section, id, split.list.slice(1)), nextPath: `${section}.${id}.bullets.${split.next - 1}` };
}

/**
 * Touche Entrée dans une ligne de liste : `before` reste dans la ligne, `after` passe dans une
 * nouvelle ligne juste en dessous, au chemin `nextPath`. Curseur au tout début : le texte ne bouge
 * pas et la nouvelle ligne est vide. Intitulé d'un élément (`below`, cf. enterAction) : le texte ne
 * change pas, la ligne vide est créée dessous. null si la liste est pleine ou si le chemin ne
 * correspond à rien. `newId` : identifiant d'un nouvel élément, fourni par l'appelant pour que le
 * résultat ne change pas si la fonction est rejouée.
 */
export function splitLine(data: CvData, path: string, textBefore: string, textAfter: string, newId: string): LineSplit | null {
  const heading = path.match(HEADING_PATH);
  if (heading) return heading[1] ? firstBullet(data, "experiences", heading[1]) : firstBullet(data, "education", heading[2]);
  const [before, after] = textBefore.trim() ? [textBefore, textAfter] : [textAfter, ""];
  const isBlank = (line: string) => !line.trim();
  const honorsOf = path.match(HONORS_PATH);
  if (honorsOf) {
    // La mention précède les puces de sa formation : Entrée y crée la première puce.
    const education = data.education.find((e) => e.id === honorsOf[1]);
    if (!education) return null;
    const split = withLineAfter([education.honors, ...education.bullets], 0, before, after, isBlank, CV_LIMITS.bullets + 1);
    if (!split) return null;
    return {
      data: withEducation(data, education.id, { honors: split.list[0], bullets: split.list.slice(1) }),
      nextPath: `education.${education.id}.bullets.${split.next - 1}`,
    };
  }
  const bullet = path.match(BULLET_PATH);
  if (bullet) {
    const [, section, id, position] = bullet;
    const index = Number(position);
    const owner = bulletOwner(data, section, id);
    if (!owner || index >= owner.bullets.length) return null;
    const split = withLineAfter(owner.bullets, index, before, after, isBlank, CV_LIMITS.bullets);
    if (!split) return null;
    return { data: withBullets(data, section, id, split.list), nextPath: `${section}.${id}.bullets.${split.next}` };
  }
  const interest = path.match(INTEREST_PATH);
  if (interest) {
    const lines = readInterests(data.interests);
    const index = Number(interest[1]);
    if (index >= lines.length) return null;
    const split = withLineAfter(lines, index, before, after, isBlank, Infinity);
    const text = split && writeInterests(split.list);
    if (!split || !text || text.length > CV_LIMITS.interests) return null;
    return { data: { ...data, interests: text }, nextPath: `interests.${split.next}` };
  }
  const detail = path.match(ITEM_DETAIL_PATH);
  const named = path.match(ITEM_NAME_PATH);
  const section = (detail?.[1] ?? named?.[1]) as NamedSection | undefined;
  if (!section) return null;
  const items = itemsOf(data, section);
  const index = items.findIndex((item) => item.id === (detail?.[2] ?? named?.[2]));
  if (index < 0) return null;
  // Projet sans description : Entrée y descend, la suite du nom y passe.
  if (section === "projects" && !data.projects[index].description.trim()) {
    const project = data.projects[index];
    return {
      data: { ...data, projects: data.projects.map((p, i) => (i === index ? { ...p, name: before, description: after } : p)) },
      nextPath: `projects.${project.id}.description`,
    };
  }
  // Coupe sur une virgule : elle séparait les deux parties, elle ne reste sur aucune.
  const added = { ...NEW_ITEM[section](newId), name: detail ? "" : after.replace(/^[\s,;]+/, "") };
  const current = detail ? items[index] : { ...items[index], name: before.replace(/[\s,;]+$/, "") };
  const split = withLineAfter(items, index, current, added, isEmptyEntry, listMax(section));
  return split && { data: withItems(data, section, split.list), nextPath: `${section}.${split.list[split.next].id}.name` };
}

/**
 * Résultat d'un Retour arrière : CV et position du curseur, texte trop long pour être recollé, ou
 * élément qui a d'autres informations (niveau, organisme, lien…), qu'un recollage ferait perdre.
 */
export type LineMerge = { data: CvData; targetPath: string; offset: number } | { tooLong: true } | { hasDetails: true };

/**
 * Liste où la ligne d'`index` rejoint la précédente non vide (les lignes vides cachées entre les deux
 * disparaissent), et position du curseur : à la jonction, ou en fin de ligne si la ligne était vide.
 * null s'il n'y a pas de ligne précédente.
 */
function withLineMerged<T>(list: T[], index: number, textOf: (item: T) => string, withText: (item: T, text: string) => T, separator: (previous: string) => string, max: (previous: number) => number) {
  let previous = index - 1;
  while (previous >= 0 && !textOf(list[previous]).trim()) previous--;
  if (previous < 0) return null;
  const before = textOf(list[previous]);
  const current = textOf(list[index]);
  const empty = !current.trim();
  const joint = empty ? "" : separator(before);
  const text = empty ? before : `${before}${joint}${current}`;
  if (text.length > max(previous)) return "tooLong" as const;
  return {
    list: [...list.slice(0, previous), withText(list[previous], text), ...list.slice(index + 1)],
    previous,
    offset: before.length + joint.length,
  };
}

/** Ligne vide en tête des puces : retirée, le curseur revient à la fin de l'intitulé qu'elle suit. */
function blankBulletRemoved(data: CvData, section: string, id: string, index: number): LineMerge | null {
  const owner = bulletOwner(data, section, id);
  if (!owner || owner.bullets[index]?.trim()) return null;
  const heading =
    section === "education"
      ? data.education.find((e) => e.id === id)?.degree.trim() ? "degree" : "school"
      : data.experiences.find((e) => e.id === id)?.position.trim() ? "position" : "company";
  const text = String((owner as unknown as Record<string, unknown>)[heading] ?? "");
  return { data: withBullets(data, section, id, owner.bullets.filter((_, i) => i !== index)), targetPath: `${section}.${id}.${heading}`, offset: text.length };
}

/**
 * Retour arrière au tout début d'une ligne de liste, geste inverse d'Entrée : son texte rejoint la fin
 * de la ligne précédente, séparé comme Entrée l'avait coupé (espace entre puces et après un intitulé
 * seul, virgule entre compétences). Une ligne vide est simplement retirée. La première puce d'une
 * formation rejoint sa mention. Une description de projet sur une ligne rejoint le nom. Un élément qui
 * a d'autres informations reste en place (`hasDetails`). null pour la première ligne.
 */
export function mergeLine(data: CvData, path: string): LineMerge | null {
  const description = path.match(DESCRIPTION_PATH);
  if (description) {
    const project = data.projects.find((p) => p.id === description[1]);
    if (!project || project.description.includes("\n")) return null;
    const blank = !project.description.trim();
    const name = blank ? project.name : `${project.name} ${project.description}`;
    if (name.length > CV_LIMITS.short) return { tooLong: true };
    return {
      data: { ...data, projects: data.projects.map((p) => (p.id === project.id ? { ...p, name, description: "" } : p)) },
      targetPath: `projects.${project.id}.name`,
      offset: project.name.length + (blank ? 0 : 1),
    };
  }
  const bullet = path.match(BULLET_PATH);
  if (bullet) {
    const [, section, id, position] = bullet;
    const index = Number(position);
    const owner = bulletOwner(data, section, id);
    if (!owner || index >= owner.bullets.length) return null;
    // Formation : sa mention est la ligne qui précède ses puces.
    const honors = section === "education" ? (data.education.find((e) => e.id === id)?.honors ?? "") : "";
    const head = honors.trim() ? [honors] : [];
    const merged = withLineMerged(
      [...head, ...owner.bullets],
      index + head.length,
      (line) => line,
      (_, text) => text,
      () => " ",
      (previous) => (head.length && previous === 0 ? CV_LIMITS.short : CV_LIMITS.bullet),
    );
    if (merged === "tooLong") return { tooLong: true };
    if (!merged) return blankBulletRemoved(data, section, id, index);
    const bullets = merged.list.slice(head.length);
    const updated = withBullets(data, section, id, bullets);
    if (head.length && merged.previous === 0) {
      return { data: withEducation(updated, id, { honors: merged.list[0] }), targetPath: `education.${id}.honors`, offset: merged.offset };
    }
    return { data: updated, targetPath: `${section}.${id}.bullets.${merged.previous - head.length}`, offset: merged.offset };
  }
  const interest = path.match(INTEREST_PATH);
  if (interest) {
    const merged = withLineMerged(readInterests(data.interests), Number(interest[1]), (line) => line, (_, text) => text, () => " ", () => CV_LIMITS.interests);
    if (merged === "tooLong") return { tooLong: true };
    if (!merged) return null;
    return { data: { ...data, interests: writeInterests(merged.list) }, targetPath: `interests.${merged.previous}`, offset: merged.offset };
  }
  const named = path.match(ITEM_NAME_PATH);
  if (!named) return null;
  const section = named[1] as NamedSection;
  const items = itemsOf(data, section);
  const index = items.findIndex((item) => item.id === named[2]);
  if (index < 0) return null;
  const merged = withLineMerged(
    items,
    index,
    (item) => item.name,
    (item, name) => ({ ...item, name }),
    (previous) => (section === "skills" && splitSkillGroup(previous)?.items.trim() === "" ? " " : ITEM_JOINT[section]),
    () => fieldLimit(path),
  );
  if (!merged) return null;
  if (!isEmptyEntry({ ...items[index], name: "" })) return { hasDetails: true };
  if (merged === "tooLong") return { tooLong: true };
  return { data: withItems(data, section, merged.list), targetPath: `${section}.${merged.list[merged.previous].id}.name`, offset: merged.offset };
}

/** Message d'un Retour arrière bloqué. */
export const lineMergeMessage = (merge: { tooLong: true } | { hasDetails: true }) =>
  "tooLong" in merge ? "Texte trop long pour être recollé à la ligne précédente" : "Cet élément a d'autres informations : efface-les d'abord pour le recoller au précédent";

/**
 * CV sans ses lignes de liste vides ou faites d'espaces (puces, compétences, langues, certifications,
 * projets entièrement vides, lignes vides des centres d'intérêt). Elles ne servent qu'à l'éditeur, le
 * temps d'une saisie : ni la base ni le coach ne les voient, et la ligne en cours de saisie reste dans
 * l'état de l'éditeur. Les sauts de ligne de l'accroche et des descriptions ne sont pas touchés.
 */
export function withoutEmptyLines<T extends Pick<CvData, "experiences" | "education" | "skills" | "languages" | "certifications" | "projects" | "interests">>(data: T): T {
  const filled = <I extends { bullets: string[] }>(item: I): I =>
    item.bullets.every((b) => b.trim()) ? item : { ...item, bullets: item.bullets.filter((b) => b.trim()) };
  const interests = data.interests.includes("\n") ? data.interests.split("\n").filter((line) => line.trim()).join("\n") : data.interests;
  return {
    ...data,
    experiences: data.experiences.map(filled),
    education: data.education.map(filled),
    skills: data.skills.filter((s) => s.name.trim()),
    languages: data.languages.filter((l) => !isEmptyEntry(l)),
    certifications: data.certifications.filter((c) => !isEmptyEntry(c)),
    projects: data.projects.filter((p) => !isEmptyEntry(p)),
    interests,
  };
}

/** Contenu du CV transmis au chat « Affiner avec l'IA » : sans la photo, les réglages de mise en page ni les lignes vides. */
export function chatContent(data: CvData) {
  const { personal, summary, experiences, education, skills, languages, certifications, projects, interests } = withoutEmptyLines(data);
  // photo: undefined → absente du JSON.
  return { personal: { ...personal, photo: undefined }, summary, experiences, education, skills, languages, certifications, projects, interests };
}

/** Texte du CV, une information par ligne : comparé aux mots-clés d'une offre, transmis à la lettre. */
export function cvDataToText(data: CvData) {
  return [
    fullName(data),
    data.personal.jobTitle,
    data.summary,
    ...data.experiences.flatMap((e) => [e.position, e.company, e.location, ...e.bullets]),
    ...data.education.flatMap((e) => [e.degree, e.school, e.honors, ...e.bullets]),
    ...data.skills.map((s) => s.name),
    ...data.languages.map((l) => `${l.name} ${l.level}`),
    ...data.certifications.flatMap((c) => [c.name, c.issuer]),
    ...data.projects.flatMap((p) => [p.name, p.description]),
    data.interests,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Textes du CV ajoutés ou modifiés entre deux versions, sous forme de chemins d'aperçu
 * (cf. applyEdit) : "personal.jobTitle", "skills.<id>.name", "experiences.<id>.bullets.1".
 * Les éléments de liste sont suivis par leur id, et une puce n'est retenue que si son texte est
 * nouveau : un ajout, une suppression ou un déplacement ne signale pas les éléments voisins.
 * Les textes vidés et les éléments supprimés ne donnent aucun chemin (plus rien à afficher).
 */
export function diffCvData(before: CvData, after: CvData): string[] {
  const paths: string[] = [];
  const walk = (previous: unknown, next: unknown, path: string) => {
    if (typeof next === "string") {
      if (next !== previous && next.trim()) paths.push(path);
    } else if (Array.isArray(next)) {
      const old: unknown[] = Array.isArray(previous) ? [...previous] : [];
      next.forEach((item, index) => {
        if (typeof item === "string") {
          const known = old.indexOf(item);
          if (known >= 0) old.splice(known, 1);
          else if (item.trim()) paths.push(`${path}.${index}`);
        } else {
          const id = (item as { id: string }).id;
          walk(old.find((o) => (o as { id?: string } | null)?.id === id), item, `${path}.${id}`);
        }
      });
    } else if (next && typeof next === "object") {
      for (const [key, value] of Object.entries(next)) {
        if (key === "id") continue;
        walk((previous as Record<string, unknown> | undefined)?.[key], value, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(chatContent(before), chatContent(after), "");
  return paths;
}
