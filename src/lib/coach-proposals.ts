import { z } from "zod";

import { CvDataSchema, newItemId, type CvData } from "./cv-builder-types";
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
  }),
  education: z.object({ id: z.string(), school: optional, degree: optional, startDate: optional, endDate: optional, honors: optional }),
  projects: z.object({ id: z.string(), name: optional, description: optional, link: optional }),
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
  | (ChangeBase & { kind: "bullet"; experienceId: string; index: number | null })
  | (ChangeBase & { kind: "field"; target: FieldTarget; itemId: string | null; field: string })
  | (ChangeBase & { kind: "list"; target: ListTarget; value: Item[]; previous: Item[] })
  | (ChangeBase & { kind: "item"; target: ItemTarget; value: Item });

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
      if (!existing) {
        changes.push(...newItemChange(target, update.data as Record<string, unknown>, makeId));
        break;
      }
      const name = itemName(target, existing);
      for (const [key, value] of Object.entries(update.data)) {
        if (key === "id" || key === "bullets" || key === "current" || typeof value !== "string") continue;
        if (key in existing) field(target, existing.id, key, `${name} — ${ITEM_FIELD_LABELS[key] ?? key}`, String(existing[key] ?? ""), value);
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
            label: replaced ? `${name} — puce ${b.index + 1}` : `${name} — nouvelle puce`,
            before: replaced ? bullets[b.index] : null,
            after,
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
  if (itemName(target, value) === itemName(target, {}) && !(value.bullets as string[] | undefined)?.length) return [];
  const label = { experience: "Nouvelle expérience", education: "Nouvelle formation", projects: "Nouveau projet" }[target];
  return [{ id: makeId(), kind: "item", target, label, before: null, after: itemText(target, value), value }];
}

// ---------------------------------------------------------------------------
// Vérification par le code (côté serveur, avant d'afficher la proposition)
// ---------------------------------------------------------------------------

/** Textes refusés d'un changement et leurs défauts. */
export type ChangeProblem = { changeId: string; text: string; problems: string[] };

/**
 * Défauts des textes proposés : une puce d'expérience doit commencer par un verbe ou un nom
 * d'action, contenir un chiffre ou un ordre de grandeur, et n'utiliser aucune formule de la liste
 * noire ; les autres textes, seulement la liste noire.
 */
export function checkProposal(proposal: CoachProposal, context: Pick<ScoringContext, "actionVerbs" | "avoid">): ChangeProblem[] {
  const isAction = actionDetector(context.actionVerbs);
  const banned = bannedPhrases(context.avoid);
  const check = (text: string, bullet: boolean) => [
    ...(bullet && !isAction(text) ? ["ne commence pas par un verbe ou un nom d'action"] : []),
    ...(bullet && !hasFigure(text) ? ["ne contient ni chiffre ni ordre de grandeur"] : []),
    ...findBannedPhrases(text, banned).map((phrase) => `contient la formule à éviter « ${phrase} »`),
  ];

  return proposal.changes.flatMap((change) => {
    const texts =
      change.kind === "bullet"
        ? [{ text: change.after, bullet: true }]
        : change.kind === "item" && change.target === "experience"
          ? (change.value.bullets as string[]).map((text) => ({ text, bullet: true }))
          : [{ text: change.after, bullet: false }];
    return texts.flatMap(({ text, bullet }) => {
      const problems = check(text, bullet);
      return problems.length ? [{ changeId: change.id, text, problems }] : [];
    });
  });
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

/**
 * CV avec le changement appliqué ; null si le passage concerné a changé entre-temps (le « avant »
 * n'est plus là) ou si le résultat est invalide.
 */
export function applyCoachChange(data: CvData, change: CoachChange): CvData | null {
  const next = copy(data);
  switch (change.kind) {
    case "bullet": {
      const experience = next.experiences.find((e) => e.id === change.experienceId);
      if (!experience) return null;
      if (change.before === null) experience.bullets.push(change.after);
      else {
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
    case "item": {
      const items = next[ITEM_KEYS[change.target]] as Item[];
      if (items.some((i) => i.id === change.value.id)) return null;
      items.push(change.value);
      break;
    }
  }
  return valid(next);
}
