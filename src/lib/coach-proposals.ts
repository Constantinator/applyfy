import { z } from "zod";

import { CV_LIMITS, CvDataSchema, invalidCvField, newItemId, splitSkillGroup, type CvData } from "./cv-builder-types";
import { actionDetector, bannedPhrases, findBannedPhrases, hasFigure, type ScoringContext } from "./cv-score";

// Modifications du CV par le coach du CV Builder : la réponse du coach est transformée en
// changements (puce, champ, liste, nouvel élément) avec le « avant » lu dans le CV, vérifiés par
// le code (puces), puis appliqués directement au CV (actions/cv-builder.ts).

/** Sections que le coach peut modifier (une par réponse). */
export const COACH_SECTIONS = [
  "personal",
  "summary",
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
  "projects",
  "interests",
] as const;
export type CoachSection = (typeof COACH_SECTIONS)[number];

/**
 * Mode d'une réponse du coach, déclaré par le modèle : « demande » (il exécute une demande
 * explicite du candidat) ou « parcours » (il suit ses points à corriger).
 */
export type CoachMode = "demande" | "parcours";

const optional = z.string().optional();
const LEVELS = ["", "debutant", "intermediaire", "avance", "expert"] as const;

/**
 * Contenu de « data » dans la réponse du coach, section par section (JSON, sauf summary et
 * interests : le texte lui-même). Validé côté serveur ; le « avant » est toujours lu dans le CV.
 */
export const COACH_DATA_SCHEMAS = {
  personal: z.object({
    firstName: optional,
    lastName: optional,
    jobTitle: optional,
    email: optional,
    phone: optional,
    city: optional,
    linkedin: optional,
    website: optional,
    github: optional,
  }),
  summary: z.string(),
  interests: z.string(),
  experience: z.object({
    id: z.string(),
    position: optional,
    company: optional,
    startDate: optional,
    endDate: optional,
    current: z.boolean().optional(),
    location: optional,
    bullets: z.array(z.object({ index: z.number().int(), after: z.string() })).default([]),
    /** Positions des puces à supprimer (0 = première). */
    bullets_to_remove: z.array(z.number().int()).default([]),
    /** Supprime l'expérience entière. */
    remove: z.boolean().optional(),
  }),
  education: z.object({
    id: z.string(),
    school: optional,
    degree: optional,
    startDate: optional,
    endDate: optional,
    honors: optional,
    /** Liste complète des puces de la formation (cours suivis, classements…). */
    bullets: z.array(z.string()).optional(),
    remove: z.boolean().optional(),
  }),
  projects: z.object({ id: z.string(), name: optional, description: optional, link: optional, remove: z.boolean().optional() }),
  skills: z.array(z.object({ name: z.string(), level: z.enum(LEVELS).catch("") })),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), date: z.string() })),
} as const satisfies Record<CoachSection, z.ZodType>;

/** Modification demandée par le coach : une section et son contenu validé. */
export type CoachUpdate = {
  [S in CoachSection]: { section: S; data: z.infer<(typeof COACH_DATA_SCHEMAS)[S]> };
}[CoachSection];

/** Sections à un champ texte, et éléments d'une liste (expérience, formation, projet). */
type FieldTarget = "personal" | "summary" | "interests" | "experience" | "education" | "projects";
type ListTarget = "skills" | "languages" | "certifications";
type ItemTarget = "experience" | "education" | "projects";
type Item = { id: string } & Record<string, unknown>;

type ChangeBase = {
  id: string;
  /** Ce qui change, ex. « Auditrice chez Cabinet Audit — puce 2 », « Titre du CV ». */
  label: string;
  /** Texte avant (null : ajout). */
  before: string | null;
  /** Texte après. */
  after: string;
};

export type CoachChange =
  /** `moved` : le texte existe déjà dans cette expérience, la puce est seulement déplacée. */
  | (ChangeBase & { kind: "bullet"; experienceId: string; index: number | null; moved: boolean })
  | (ChangeBase & { kind: "field"; target: FieldTarget; itemId: string | null; field: string })
  | (ChangeBase & { kind: "list"; target: ListTarget; value: Item[]; previous: Item[] })
  | (ChangeBase & { kind: "item"; target: ItemTarget; value: Item })
  /** Puces d'une formation : toute la liste est remplacée. */
  | (ChangeBase & { kind: "educationBullets"; educationId: string; bullets: string[] })
  /** Suppression d'une puce : `before` est son texte dans le CV, `index` sa position. */
  | (ChangeBase & { kind: "removeBullet"; experienceId: string; index: number })
  /** Suppression d'une expérience, d'une formation ou d'un projet entier. */
  | (ChangeBase & { kind: "removeItem"; target: ItemTarget; itemId: string });

export type CoachProposal = { id: string; changes: CoachChange[] };

const ITEM_KEYS = { experience: "experiences", education: "education", projects: "projects" } as const;

const PERSONAL_LABELS: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  jobTitle: "Titre du CV",
  email: "Email",
  phone: "Téléphone",
  city: "Ville",
  linkedin: "LinkedIn",
  website: "Site web",
  github: "GitHub",
};
const SECTION_LABELS = {
  summary: "Accroche",
  interests: "Centres d'intérêt",
  skills: "Compétences",
  languages: "Langues",
  certifications: "Certifications",
} as const;
const ITEM_FIELD_LABELS: Record<string, string> = {
  position: "Poste",
  company: "Entreprise",
  startDate: "Début",
  endDate: "Fin",
  location: "Lieu",
  school: "École",
  degree: "Diplôme",
  honors: "Mention",
  name: "Nom",
  description: "Description",
  link: "Lien",
};

const clean = (text: string | undefined) => (text ?? "").trim();

function experienceName(e: { position?: unknown; company?: unknown }) {
  const position = clean(String(e.position ?? ""));
  const company = clean(String(e.company ?? ""));
  return position && company ? `${position} chez ${company}` : position || company || "Expérience";
}

function itemName(target: ItemTarget, item: Record<string, unknown>) {
  if (target === "experience") return experienceName(item);
  if (target === "education") return clean(String(item.degree ?? "")) || clean(String(item.school ?? "")) || "Formation";
  return clean(String(item.name ?? "")) || "Projet";
}

/** Liste affichée en une ligne : « Excel (avancé), SQL ». */
function listText(target: ListTarget, items: Record<string, unknown>[]) {
  return items
    .map((i) => {
      const name = clean(String(i.name ?? ""));
      if (target === "certifications") return [name, clean(String(i.issuer ?? ""))].filter(Boolean).join(" — ");
      const level = clean(String(i.level ?? ""));
      return level ? `${name} (${level})` : name;
    })
    .filter(Boolean)
    .join(", ");
}

/** Nouvel élément affiché : intitulé, puis ses puces ou sa description. */
function itemText(target: ItemTarget, item: Record<string, unknown>) {
  const lines = [itemName(target, item)];
  if (target === "experience") lines.push(...(item.bullets as string[]).map((b) => `• ${b}`));
  if (target === "projects" && clean(String(item.description ?? ""))) lines.push(String(item.description));
  return lines.join("\n");
}

/**
 * Proposition construite à partir de la réponse du coach et du CV actuel : seules les différences,
 * avec le « avant » lu dans le CV. null si rien ne change.
 */
export function buildProposal(current: CvData, update: CoachUpdate, makeId: () => string = newItemId): CoachProposal | null {
  const changes: CoachChange[] = [];
  const field = (target: FieldTarget, itemId: string | null, key: string, label: string, before: string, after: string | undefined) => {
    const next = clean(after);
    if (after === undefined || next === clean(before)) return;
    changes.push({ id: makeId(), kind: "field", target, itemId, field: key, label, before, after: next });
  };

  switch (update.section) {
    case "personal":
      for (const [key, value] of Object.entries(update.data)) {
        if (key in PERSONAL_LABELS) {
          field("personal", null, key, PERSONAL_LABELS[key], String((current.personal as Fields)[key] ?? ""), value);
        }
      }
      break;
    case "summary":
    case "interests":
      field(update.section, null, update.section, SECTION_LABELS[update.section], current[update.section], update.data);
      break;
    case "experience":
    case "education":
    case "projects": {
      const target = update.section;
      const items = current[ITEM_KEYS[target]] as Item[];
      const existing = update.data.id ? items.find((i) => i.id === update.data.id) : undefined;
      // Suppression de l'élément entier : seulement s'il existe (id inconnu : rien à supprimer).
      if (update.data.remove) {
        if (existing) {
          changes.push({
            id: makeId(),
            kind: "removeItem",
            target,
            itemId: existing.id,
            label: `${itemName(target, existing)} — supprimé`,
            before: itemText(target, existing),
            after: "",
          });
        }
        break;
      }
      if (!existing) {
        changes.push(...newItemChange(target, update.data as Record<string, unknown>, makeId));
        break;
      }
      const name = itemName(target, existing);
      for (const [key, value] of Object.entries(update.data)) {
        if (key === "id" || key === "bullets" || key === "bullets_to_remove" || key === "current" || typeof value !== "string") continue;
        if (key in existing) field(target, existing.id, key, `${name} — ${ITEM_FIELD_LABELS[key] ?? key}`, String(existing[key] ?? ""), value);
      }
      if (update.section === "education" && update.data.bullets) {
        const next = update.data.bullets.map(clean).filter(Boolean);
        const before = (existing.bullets as string[]).map(clean).filter(Boolean);
        if (next.join("\n") !== before.join("\n")) {
          changes.push({
            id: makeId(),
            kind: "educationBullets",
            educationId: existing.id,
            bullets: next,
            label: `${name} — puces`,
            before: before.join("\n"),
            after: next.join("\n"),
          });
        }
      }
      if (update.section === "experience") {
        const bullets = existing.bullets as string[];
        for (const b of update.data.bullets) {
          const after = clean(b.after);
          if (!after) continue;
          const replaced = b.index >= 0 && b.index < bullets.length;
          if (replaced && clean(bullets[b.index]) === after) continue;
          changes.push({
            id: makeId(),
            kind: "bullet",
            experienceId: existing.id,
            index: replaced ? b.index : null,
            moved: replaced && bullets.some((text) => clean(text) === after),
            label: replaced ? `${name} — puce ${b.index + 1}` : `${name} — nouvelle puce`,
            before: replaced ? bullets[b.index] : null,
            after,
          });
        }
        // Puces supprimées : position hors limites ignorée, une seule suppression par position.
        for (const index of new Set(update.data.bullets_to_remove)) {
          if (index < 0 || index >= bullets.length) continue;
          changes.push({
            id: makeId(),
            kind: "removeBullet",
            experienceId: existing.id,
            index,
            label: `${name} — puce ${index + 1} supprimée`,
            before: bullets[index],
            after: "",
          });
        }
      }
      break;
    }
    case "skills":
    case "languages":
    case "certifications": {
      const target = update.section;
      const previous = current[target] as Item[];
      const value = update.data
        .filter((i) => clean(i.name))
        .map((i) => ({ ...i, name: clean(i.name), id: previous.find((p) => clean(String(p.name)) === clean(i.name))?.id ?? makeId() }));
      const before = listText(target, previous);
      const after = listText(target, value);
      if (after && after !== before) {
        changes.push({ id: makeId(), kind: "list", target, label: SECTION_LABELS[target], before, after, value, previous });
      }
      break;
    }
  }
  return changes.length ? { id: makeId(), changes } : null;
}

/** Nouvelle expérience, formation ou projet : un seul bloc à accepter ou refuser. */
function newItemChange(target: ItemTarget, data: Record<string, unknown>, makeId: () => string): CoachChange[] {
  const value: Item = { id: makeId() };
  for (const [key, v] of Object.entries(data)) if (key !== "id" && key !== "bullets" && typeof v === "string") value[key] = clean(v);
  if (target === "experience") {
    value.current = data.current === true;
    value.bullets = ((data.bullets as { after: string }[] | undefined) ?? []).map((b) => clean(b.after)).filter(Boolean);
  }
  if (target === "education") value.bullets = ((data.bullets as string[] | undefined) ?? []).map(clean).filter(Boolean);
  if (itemName(target, value) === itemName(target, {}) && !(value.bullets as string[] | undefined)?.length) return [];
  const label = { experience: "Nouvelle expérience", education: "Nouvelle formation", projects: "Nouveau projet" }[target];
  return [{ id: makeId(), kind: "item", target, label, before: null, after: itemText(target, value), value }];
}

// ---------------------------------------------------------------------------
// Vérification par le code (côté serveur, avant d'afficher la proposition)
// ---------------------------------------------------------------------------

/** Défauts d'un texte refusé (aussi envoyés au modèle lors du nouvel essai : ne pas en changer le texte). */
export const PROBLEM_NO_VERB = "ne commence pas par un verbe ou un nom d'action";
export const PROBLEM_NO_FIGURE = "ne contient ni chiffre ni ordre de grandeur";
export const PROBLEM_BANNED_PREFIX = "contient la formule à éviter « ";
/** Mode demande : régression par rapport au texte d'origine, et nombre absent des sources. */
export const PROBLEM_LOST_VERB = "ne commence plus par un verbe ou un nom d'action, contrairement à la puce d'origine";
export const PROBLEM_LOST_FIGURE = "a perdu le chiffre ou l'ordre de grandeur de la puce d'origine";
export const PROBLEM_NEW_NUMBER_PREFIX = "contient un nombre absent du CV et des messages du candidat : ";

/** Textes refusés d'un changement et leurs défauts. */
export type ChangeProblem = {
  changeId: string;
  text: string;
  problems: string[];
  /** Refus lié à une limite du CV (longueur, nombre d'éléments), et non au contenu du texte. */
  limit?: boolean;
  /** Avec `limit` : chemin du champ en cause (ex. « experiences.0.bullets »). */
  path?: string;
};

/** Mode de la réponse et messages du candidat (source autorisée des nombres, avec le CV). */
export type CheckOptions = { mode?: CoachMode; candidateMessages?: string[] };

/**
 * Défauts des textes proposés.
 * - Mode « parcours » (par défaut) : une puce d'expérience doit commencer par un verbe ou un nom
 *   d'action, contenir un chiffre ou un ordre de grandeur, et n'utiliser aucune formule de la liste
 *   noire ; les autres textes, seulement la liste noire.
 * - Mode « demande » : règle de non-régression. Une puce modifiée ne doit pas être moins bonne
 *   qu'avant (elle garde son chiffre et son verbe d'action si elle en avait, aucune formule de la
 *   liste noire ajoutée) ; une puce nouvelle doit commencer par un verbe d'action, sans chiffre
 *   exigé ; et aucun texte ne contient un nombre absent du CV et des messages du candidat.
 * Dans les deux modes, une réorganisation n'ajoute rien : une puce déplacée n'est pas vérifiée, et
 * une liste n'est refusée que pour une formule qu'elle n'avait pas. Tout changement qui rendrait le
 * CV invalide (limite dépassée) est refusé aussi, avec le champ en cause.
 */
export function checkProposal(
  proposal: CoachProposal,
  context: Pick<ScoringContext, "actionVerbs" | "avoid">,
  current: CvData,
  options: CheckOptions = {},
): ChangeProblem[] {
  const problems =
    options.mode === "demande"
      ? requestProblems(proposal, context, numberSources([...cvStrings(current), ...(options.candidateMessages ?? [])]))
      : textProblems(proposal, context);
  let state = current;
  for (const change of proposal.changes) {
    if (problems.some((p) => p.changeId === change.id)) continue;
    const next = withChange(state, change);
    if (!next) continue; // passage introuvable : ignoré à l'application
    const parsed = CvDataSchema.safeParse(next);
    if (parsed.success) state = parsed.data;
    else {
      const field = invalidCvField(parsed.error);
      problems.push({ changeId: change.id, text: change.after.slice(0, 120), problems: [field.message], limit: true, path: field.path });
    }
  }
  return problems;
}

/** Textes d'un changement : puces d'une expérience ajoutée, ou le texte « après ». */
function changeTexts(change: CoachChange): { text: string; bullet: boolean }[] {
  if (change.kind === "bullet") return [{ text: change.after, bullet: true }];
  if (change.kind === "item" && change.target === "experience") {
    return (change.value.bullets as string[]).map((text) => ({ text, bullet: true }));
  }
  return [{ text: change.after, bullet: false }];
}

function textProblems(proposal: CoachProposal, context: Pick<ScoringContext, "actionVerbs" | "avoid">): ChangeProblem[] {
  const isAction = actionDetector(context.actionVerbs);
  const banned = bannedPhrases(context.avoid);
  const check = (text: string, bullet: boolean) => [
    ...(bullet && !isAction(text) ? [PROBLEM_NO_VERB] : []),
    ...(bullet && !hasFigure(text) ? [PROBLEM_NO_FIGURE] : []),
    ...findBannedPhrases(text, banned).map((phrase) => `${PROBLEM_BANNED_PREFIX}${phrase} »`),
  ];

  return proposal.changes.flatMap((change) => {
    if (change.kind === "removeBullet" || change.kind === "removeItem") return [];
    if (change.kind === "bullet" && change.moved) return [];
    if (change.kind === "list") {
      const existing = findBannedPhrases(change.before ?? "", banned);
      const added = findBannedPhrases(change.after, banned).filter((phrase) => !existing.includes(phrase));
      return added.length
        ? [{ changeId: change.id, text: change.after, problems: added.map((phrase) => `${PROBLEM_BANNED_PREFIX}${phrase} »`) }]
        : [];
    }
    return changeTexts(change).flatMap(({ text, bullet }) => {
      const problems = check(text, bullet);
      return problems.length ? [{ changeId: change.id, text, problems }] : [];
    });
  });
}

/** Mode demande : non-régression des textes modifiés, verbe d'action des puces nouvelles, nombres inventés. */
function requestProblems(
  proposal: CoachProposal,
  context: Pick<ScoringContext, "actionVerbs" | "avoid">,
  allowed: Set<string>,
): ChangeProblem[] {
  const isAction = actionDetector(context.actionVerbs);
  const banned = bannedPhrases(context.avoid);

  return proposal.changes.flatMap((change) => {
    if (change.kind === "removeBullet" || change.kind === "removeItem") return [];
    if (change.kind === "bullet" && change.moved) return [];
    const before = change.before ?? "";
    const existing = findBannedPhrases(before, banned);
    return changeTexts(change).flatMap(({ text, bullet }) => {
      const problems: string[] = [];
      if (bullet && !isAction(text)) {
        // Puce nouvelle : verbe exigé ; puce modifiée : seulement si elle en avait un.
        if (change.before === null) problems.push(PROBLEM_NO_VERB);
        else if (isAction(before)) problems.push(PROBLEM_LOST_VERB);
      }
      if (bullet && change.before !== null && hasFigure(before) && !hasFigure(text)) problems.push(PROBLEM_LOST_FIGURE);
      for (const phrase of findBannedPhrases(text, banned)) {
        if (!existing.includes(phrase)) problems.push(`${PROBLEM_BANNED_PREFIX}${phrase} »`);
      }
      // Sources : le contenu du CV, les messages du candidat et le texte d'origine du passage.
      const invented = sameDigits(before, text) ? [] : inventedNumbers(text, new Set([...allowed, ...numberSources([before])]));
      if (invented.length) problems.push(`${PROBLEM_NEW_NUMBER_PREFIX}${invented.join(", ")}`);
      return problems.length ? [{ changeId: change.id, text, problems }] : [];
    });
  });
}

// ---------------------------------------------------------------------------
// Nombres inventés (mode demande) : tout nombre écrit doit venir du CV ou du candidat
// ---------------------------------------------------------------------------

/** Nombres écrits en lettres (français et anglais), avec leur valeur. */
const NUMBER_WORDS: Record<string, string> = {
  deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9", dix: "10",
  onze: "11", douze: "12", treize: "13", quatorze: "14", quinze: "15", seize: "16", vingt: "20", trente: "30",
  quarante: "40", cinquante: "50", soixante: "60", cent: "100", mille: "1000",
  two: "2", three: "3", four: "4", five: "5", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11",
  twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", twenty: "20", thirty: "30",
  forty: "40", fifty: "50", sixty: "60",
};
/** Ordres de grandeur : vérifiés aussi dans le texte proposé (« une centaine » sans source est refusé). */
const MAGNITUDE_WORDS: Record<string, string> = {
  dizaine: "10", douzaine: "12", quinzaine: "15", vingtaine: "20", trentaine: "30", quarantaine: "40",
  cinquantaine: "50", centaine: "100", millier: "1000", million: "1000000", milliard: "1000000000",
  dozen: "12", hundred: "100", thousand: "1000", billion: "1000000000",
};

const THOUSANDS = /\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+(?!\d)/g;
const wordsOf = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/\p{L}+/gu) ?? [];
const singular = (word: string) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word);

/**
 * Textes du CV qui peuvent justifier un nombre. Exclus : identifiants, photo, réglages et analyse
 * (pas des faits du candidat), et coordonnées (les chiffres d'un téléphone ne justifient pas
 * « 12 clients » ; une coordonnée modifiée est comparée à son propre texte d'origine).
 */
const NOT_CONTENT = new Set(["id", "photo", "style", "coach", "analysis", "phone", "email", "linkedin", "website", "github"]);
/** Mêmes chiffres dans le même ordre (« 0612345678 » remis en « 06 12 34 56 78 ») : rien d'inventé. */
const sameDigits = (before: string, after: string) => /\d/.test(after) && before.replace(/\D/g, "") === after.replace(/\D/g, "");
function cvStrings(value: unknown, key = ""): string[] {
  if (NOT_CONTENT.has(key)) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((v) => cvStrings(v));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => cvStrings(v, k));
  return [];
}

/**
 * Nombres autorisés : ceux des textes sources, tels qu'écrits (« 1 200 » donne aussi 1200), et la
 * valeur des nombres en lettres (« quinze », « une vingtaine »).
 */
export function numberSources(texts: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const text of texts) {
    for (const group of text.match(THOUSANDS) ?? []) allowed.add(group.replace(/\D/g, ""));
    for (const run of text.match(/\d+/g) ?? []) allowed.add(run);
    for (const word of wordsOf(text)) {
      const value = NUMBER_WORDS[word] ?? MAGNITUDE_WORDS[singular(word)];
      if (value) allowed.add(value);
    }
  }
  return allowed;
}

/** Nombres et ordres de grandeur d'un texte qui ne figurent pas dans les sources autorisées. */
export function inventedNumbers(text: string, allowed: Set<string>): string[] {
  const invented = new Set<string>();
  // Milliers groupés (« 1 200 », « 1,200 ») : acceptés si le nombre entier est connu.
  const rest = text.replace(THOUSANDS, (group) => (allowed.has(group.replace(/\D/g, "")) ? " " : group));
  for (const run of rest.match(/\d+/g) ?? []) if (!allowed.has(run)) invented.add(run);
  for (const word of wordsOf(text)) {
    const value = MAGNITUDE_WORDS[singular(word)];
    if (value && !allowed.has(value)) invented.add(word);
  }
  return [...invented];
}

/**
 * Proposition sans les textes refusés : changement retiré, ou puce retirée d'une nouvelle
 * expérience (gardée si elle a encore un intitulé). null s'il ne reste rien.
 */
export function withoutProblems(proposal: CoachProposal, problems: ChangeProblem[]): CoachProposal | null {
  const changes = proposal.changes.flatMap((change): CoachChange[] => {
    const refused = problems.filter((p) => p.changeId === change.id).map((p) => p.text);
    if (!refused.length) return [change];
    if (change.kind !== "item" || change.target !== "experience") return [];
    const value = { ...change.value, bullets: (change.value.bullets as string[]).filter((b) => !refused.includes(b)) };
    return [{ ...change, value, after: itemText("experience", value) }];
  });
  return changes.length ? { ...proposal, changes } : null;
}

// ---------------------------------------------------------------------------
// Application au CV
// ---------------------------------------------------------------------------

type Fields = Record<string, unknown>;

/** Objet qui porte un champ modifié ; null s'il n'existe plus. */
function fieldOwner(data: CvData, change: Extract<CoachChange, { kind: "field" }>): Fields | null {
  if (change.target === "personal") return data.personal as Fields;
  if (change.target === "summary" || change.target === "interests") return data as unknown as Fields;
  return ((data[ITEM_KEYS[change.target]] as Item[]).find((i) => i.id === change.itemId) as Fields | undefined) ?? null;
}

/** Copie modifiable du CV (les éléments touchés sont recréés). */
function copy(data: CvData): CvData {
  return {
    ...data,
    personal: { ...data.personal },
    experiences: data.experiences.map((e) => ({ ...e, bullets: [...e.bullets] })),
    education: data.education.map((e) => ({ ...e })),
    projects: data.projects.map((p) => ({ ...p })),
  };
}

const valid = (data: CvData) => {
  const parsed = CvDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

/** Mots de textes, sans casse, accents ni ponctuation, triés : le contenu, quel que soit son ordre. */
function contentWords(texts: string[]) {
  const words = texts.join(" ").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}+#]+/gu);
  return (words ?? []).sort().join(" ");
}

/** Contenu d'un CV, indépendant de la façon dont il est rangé (ordre, lignes, intitulés de groupes). */
function contentFingerprint(data: CvData) {
  return JSON.stringify({
    personal: data.personal,
    summary: contentWords([data.summary]),
    interests: contentWords([data.interests]),
    experiences: data.experiences.map((e) => ({ ...e, bullets: contentWords(e.bullets) })),
    education: data.education.map((e) => ({ ...e, bullets: contentWords(e.bullets) })),
    projects: data.projects,
    skills: contentWords(data.skills.map((s) => `${splitSkillGroup(s.name)?.items ?? s.name} ${s.level}`)),
    languages: contentWords(data.languages.map((l) => `${l.name} ${l.level}`)),
    certifications: contentWords(data.certifications.map((c) => `${c.name} ${c.issuer} ${c.date}`)),
  });
}

/**
 * Les deux CV ont-ils le même contenu, seulement réorganisé ? Rien d'ajouté ni de retiré, à part un
 * intitulé de groupe de compétences : une modification de ce type n'est pas décomptée.
 */
export function isReorganization(before: CvData, after: CvData) {
  return contentFingerprint(before) === contentFingerprint(after);
}

/**
 * CV avec le changement appliqué ; null si le passage concerné a changé entre-temps (le « avant »
 * n'est plus là) ou si le résultat est invalide.
 */
export function applyCoachChange(data: CvData, change: CoachChange): CvData | null {
  const next = withChange(data, change);
  return next && valid(next);
}

/** CV avec le changement appliqué, pas encore validé ; null si le passage concerné n'est plus là. */
function withChange(data: CvData, change: CoachChange): CvData | null {
  const next = copy(data);
  switch (change.kind) {
    case "bullet": {
      const experience = next.experiences.find((e) => e.id === change.experienceId);
      if (!experience) return null;
      if (change.before === null) {
        // Les puces vides ne comptent pas dans la limite : retirées s'il faut de la place.
        if (experience.bullets.length >= CV_LIMITS.bullets) experience.bullets = experience.bullets.filter((b) => b.trim());
        experience.bullets.push(change.after);
      } else {
        const index = experience.bullets[change.index ?? -1] === change.before ? change.index! : experience.bullets.indexOf(change.before);
        if (index < 0) return null;
        experience.bullets[index] = change.after;
      }
      break;
    }
    case "field": {
      const owner = fieldOwner(next, change);
      if (!owner || clean(String(owner[change.field] ?? "")) !== clean(change.before ?? "")) return null;
      owner[change.field] = change.after;
      break;
    }
    case "list":
      if (listText(change.target, next[change.target] as Item[]) !== change.before) return null;
      (next as unknown as Fields)[change.target] = change.value;
      break;
    case "removeBullet": {
      // Position d'origine si le texte y est encore, sinon la première puce identique : plusieurs
      // suppressions dans la même réponse restent justes malgré le décalage des positions.
      const experience = next.experiences.find((e) => e.id === change.experienceId);
      if (!experience || change.before === null) return null;
      const index = experience.bullets[change.index] === change.before ? change.index : experience.bullets.indexOf(change.before);
      if (index < 0) return null;
      experience.bullets.splice(index, 1);
      break;
    }
    case "removeItem": {
      const key = ITEM_KEYS[change.target];
      const items = next[key] as Item[];
      if (!items.some((i) => i.id === change.itemId)) return null;
      (next as unknown as Fields)[key] = items.filter((i) => i.id !== change.itemId);
      break;
    }
    case "item": {
      const items = next[ITEM_KEYS[change.target]] as Item[];
      if (items.some((i) => i.id === change.value.id)) return null;
      items.push(change.value);
      break;
    }
    case "educationBullets": {
      const education = next.education.find((e) => e.id === change.educationId);
      if (!education) return null;
      education.bullets = change.bullets;
      break;
    }
  }
  return next;
}
