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
  /** Cours suivis, classements… : puces sous la mention (absentes des CV plus anciens). */
  bullets: z.array(z.string().max(CV_LIMITS.bullet)).max(CV_LIMITS.bullets).default([]),
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
  skills: z.array(SkillSchema).max(CV_LIMITS.skills).default([]),
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
      /** Couleur d'accent (#rrggbb) des titres, du nom et des traits ; vide : couleur du modèle. */
      accent: z.string().regex(ACCENT_PATTERN).or(z.literal("")).catch("").default(""),
    })
    .prefault({}),
  /** CV importé : analyse de l'import (null pour un CV créé à partir d'un modèle vierge). */
  analysis: CvAnalysisSchema.nullable().catch(null).default(null),
  /** Poste visé, saisi à la création « depuis zéro » (ou à la fin de l'import) : secteur du score et du coach. */
  targetJob: z.string().max(120).catch("").default(""),
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

const SKILL_GROUP = /^(\s*(?:[^\s:]+\s*){1,4}:)(\s+\S[\s\S]*|\s*)$/;

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
const SKILL_PATH = /^skills\.([^.]+)\.name$/;

/**
 * Ligne d'une liste dans l'aperçu (puce d'expérience ou de formation, mention d'une formation, qui
 * précède ses puces, compétence) : Entrée y crée la ligne suivante.
 */
export const isLinePath = (path: string) => BULLET_PATH.test(path) || HONORS_PATH.test(path) || SKILL_PATH.test(path);

/** Nombre maximal de caractères du champ de ce chemin (cf. CvDataSchema), pour limiter la saisie. */
export function fieldLimit(path: string): number {
  const keys = path.split(".");
  const field = keys.at(-1) ?? "";
  if (keys[0] === "personal") {
    if (field === "firstName" || field === "lastName") return 60;
    if (field === "phone") return 40;
    if (field === "linkedin" || field === "website" || field === "github") return CV_LIMITS.url;
    return CV_LIMITS.short;
  }
  if (field === "summary") return CV_LIMITS.text;
  if (field === "interests") return 500;
  if (keys[0] === "languages") return 60;
  if (field === "startDate" || field === "endDate" || field === "date") return 40;
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

/** Nom lisible d'un champ du CV, d'après son chemin : « Formation 2 : mention », « Expérience 1 : puce 3 ». */
function fieldLabel(path: readonly PropertyKey[]): string {
  const [section, index, field, line] = path;
  if (section === "personal") return FIELD_LABELS[String(index)] ?? String(index);
  const name = SECTION_LABELS[String(section)];
  if (!name) return FIELD_LABELS[String(section)] ?? path.map(String).join(".");
  if (typeof index !== "number") return name;
  const item = `${name} ${index + 1}`;
  if (field === "bullets") return typeof line === "number" ? `${item} : puce ${line + 1}` : `${item} : puces`;
  return field === undefined ? item : `${item} : ${FIELD_LABELS[String(field)] ?? String(field)}`;
}

/**
 * Premier champ refusé par CvDataSchema : son chemin (journal du serveur, sans le contenu du CV) et un
 * message pour l'utilisateur, ex. « Le champ « Formation 2 : mention » est trop long (300 caractères maximum). »
 */
export function invalidCvField(error: z.ZodError): { path: string; message: string } {
  const issue = error.issues[0];
  const path = issue?.path ?? [];
  const label = fieldLabel(path);
  const tooMany = issue?.code === "too_big" && issue.origin === "array";
  const message =
    issue?.code === "too_big"
      ? tooMany
        ? `Le champ « ${label} » contient trop d'éléments (${issue.maximum} maximum).`
        : `Le champ « ${label} » est trop long (${issue.maximum} caractères maximum).`
      : `Le champ « ${label} » est invalide.`;
  return { path: path.map(String).join("."), message };
}

/** Message affiché quand Entrée est bloquée dans cette liste. */
export const lineLimitMessage = (path: string) =>
  SKILL_PATH.test(path) ? `Maximum ${CV_LIMITS.skills} compétences atteint` : `Maximum ${CV_LIMITS.bullets} puces atteint`;

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

/**
 * Touche Entrée dans une ligne de liste : `before` reste dans la ligne, `after` passe dans une
 * nouvelle ligne juste en dessous, au chemin `nextPath`. Curseur au tout début : le texte ne bouge
 * pas et la nouvelle ligne est vide. null si la liste est pleine ou si le chemin ne correspond à
 * rien. `newId` : identifiant d'une nouvelle compétence, fourni par l'appelant pour que le résultat
 * ne change pas si la fonction est rejouée.
 */
export function splitLine(data: CvData, path: string, textBefore: string, textAfter: string, newId: string): { data: CvData; nextPath: string } | null {
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
  const skillId = path.match(SKILL_PATH)?.[1];
  const index = data.skills.findIndex((s) => s.id === skillId);
  if (index < 0) return null;
  // Coupe sur une virgule : elle séparait les deux parties, elle ne reste sur aucune.
  const added = { id: newId, name: after.replace(/^[\s,;]+/, ""), level: "" as const };
  const current = { ...data.skills[index], name: before.replace(/[\s,;]+$/, "") };
  const split = withLineAfter(data.skills, index, current, added, (s) => !s.name.trim(), CV_LIMITS.skills);
  return split && { data: { ...data, skills: split.list }, nextPath: `skills.${split.list[split.next].id}.name` };
}

/** Résultat d'un Retour arrière : CV et position du curseur, ou texte trop long pour être recollé. */
export type LineMerge = { data: CvData; targetPath: string; offset: number } | { tooLong: true };

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

/**
 * Retour arrière au tout début d'une ligne de liste, geste inverse d'Entrée : son texte rejoint la fin
 * de la ligne précédente, séparé comme Entrée l'avait coupé (espace entre puces et après un intitulé
 * seul, virgule entre compétences). Une ligne vide est simplement retirée. La première puce d'une
 * formation rejoint sa mention. null pour la première ligne.
 */
export function mergeLine(data: CvData, path: string): LineMerge | null {
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
    if (!merged) return null;
    const bullets = merged.list.slice(head.length);
    const updated = withBullets(data, section, id, bullets);
    if (head.length && merged.previous === 0) {
      return { data: withEducation(updated, id, { honors: merged.list[0] }), targetPath: `education.${id}.honors`, offset: merged.offset };
    }
    return { data: updated, targetPath: `${section}.${id}.bullets.${merged.previous - head.length}`, offset: merged.offset };
  }
  const skillId = path.match(SKILL_PATH)?.[1];
  const index = data.skills.findIndex((s) => s.id === skillId);
  if (index < 0) return null;
  const merged = withLineMerged(
    data.skills,
    index,
    (s) => s.name,
    (s, name) => ({ ...s, name }),
    (previous) => (splitSkillGroup(previous)?.items.trim() === "" ? " " : ", "),
    () => CV_LIMITS.short,
  );
  if (merged === "tooLong") return { tooLong: true };
  if (!merged) return null;
  return { data: { ...data, skills: merged.list }, targetPath: `skills.${merged.list[merged.previous].id}.name`, offset: merged.offset };
}

/**
 * CV sans ses lignes de liste vides ou faites d'espaces (puces d'expérience et de formation,
 * compétences). Elles ne servent qu'à l'éditeur, le temps d'une saisie : ni la base ni le coach ne les
 * voient, et la ligne en cours de saisie reste dans l'état de l'éditeur.
 */
export function withoutEmptyLines<T extends Pick<CvData, "experiences" | "education" | "skills">>(data: T): T {
  const filled = <I extends { bullets: string[] }>(item: I): I =>
    item.bullets.every((b) => b.trim()) ? item : { ...item, bullets: item.bullets.filter((b) => b.trim()) };
  return {
    ...data,
    experiences: data.experiences.map(filled),
    education: data.education.map(filled),
    skills: data.skills.filter((s) => s.name.trim()),
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
