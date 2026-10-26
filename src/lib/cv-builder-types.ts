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
  text: 2000,
  bullet: 500,
  bullets: 12,
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
  startDate: text(40),
  endDate: text(40),
  current: z.boolean().default(false),
  location: text(CV_LIMITS.short),
  bullets: z.array(z.string().max(CV_LIMITS.bullet)).max(CV_LIMITS.bullets).default([]),
});

const EducationSchema = z.object({
  id,
  school: text(CV_LIMITS.short),
  degree: text(CV_LIMITS.short),
  startDate: text(40),
  endDate: text(40),
  honors: text(CV_LIMITS.short),
});

const SkillSchema = z.object({
  id,
  name: text(CV_LIMITS.short),
  level: z.enum(["", "debutant", "intermediaire", "avance", "expert"]).default(""),
});

const LanguageSchema = z.object({ id, name: text(60), level: text(60) });

const CertificationSchema = z.object({ id, name: text(CV_LIMITS.short), issuer: text(CV_LIMITS.short), date: text(40) });

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
      firstName: text(60),
      lastName: text(60),
      jobTitle: text(CV_LIMITS.short),
      email: text(CV_LIMITS.short),
      phone: text(40),
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
  skills: z.array(SkillSchema).max(40).default([]),
  languages: z.array(LanguageSchema).max(CV_LIMITS.items).default([]),
  certifications: z.array(CertificationSchema).max(CV_LIMITS.items).default([]),
  projects: z.array(ProjectSchema).max(CV_LIMITS.items).default([]),
  interests: text(500),
  style: z
    .object({
      font: z.enum(CV_FONT_IDS).catch("inter").default("inter"),
      /** Texte compact : tailles et espacements verticaux réduits, pour tenir sur une page. */
      density: z.enum(["compact", "normal", "large"]).catch("normal").default("normal"),
      /** Alignement des paragraphes et des puces. */
      align: z.enum(["left", "justify"]).catch("left").default("left"),
    })
    .prefault({}),
  /** CV importé : analyse de l'import (null pour un CV créé à partir d'un modèle vierge). */
  analysis: CvAnalysisSchema.nullable().catch(null).default(null),
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
  createdAt: string;
  updatedAt: string;
};

export type BuilderCvSummary = Omit<BuilderCv, "data"> & { jobTitle: string };

/** Données d'un CV lues en base : jamais d'échec, les champs invalides sont remis à zéro. */
export function readCvData(value: unknown): CvData {
  const parsed = CvDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : CvDataSchema.parse({});
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

/** Contenu du CV transmis au chat « Affiner avec l'IA » : sans la photo ni les réglages de mise en page. */
export function chatContent({ personal, summary, experiences, education, skills, languages, certifications, projects, interests }: CvData) {
  // photo: undefined → absente du JSON.
  return { personal: { ...personal, photo: undefined }, summary, experiences, education, skills, languages, certifications, projects, interests };
}
