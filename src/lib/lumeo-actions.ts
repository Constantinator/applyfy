// Actions que Lumeo peut proposer (lot 2), et leur exécution après confirmation de l'utilisateur.
// Fonctions pures et exécution à dépendances injectées (testables sans base ni Claude) ; le
// branchement serveur est dans app/actions/lumeo-actions.ts.
//
// Garde-fous :
// - le modèle ne choisit qu'un type parmi LUMEO_ACTION_TYPES (sortie structurée), jamais un id ;
// - l'id est celui de la fiche ouverte, revalidé, et la candidature est relue avec les droits de
//   l'utilisateur (une candidature d'un autre utilisateur n'existe pas pour lui) ;
// - rien ne s'exécute sans le clic sur « Confirmer » (seul appelant de executeLumeoAction) ;
// - une seule exécution à la fois par (utilisateur, type, candidature), réservée en base ;
// - la confirmation consomme le quota de l'action seulement, jamais une question à Lumeo.
import { z } from "zod";

import { AI_DAILY_LIMIT, type AiUsageCount, type AiUsageKind } from "./ai-usage-limits";
import { SUMMARY_MIN_LENGTH } from "./offer-limits";
import { LUMEO_ACTION_TEXTS as T } from "./lumeo-texts";

export const LUMEO_ACTION_TYPES = ["lettre", "resume_offre", "adaptation_cv"] as const;
export type LumeoActionType = (typeof LUMEO_ACTION_TYPES)[number];

/** Choix du modèle dans sa réponse : une action de la liste, ou aucune. */
export const LUMEO_MODEL_ACTIONS = ["aucune", ...LUMEO_ACTION_TYPES] as const;
export type LumeoModelAction = (typeof LUMEO_MODEL_ACTIONS)[number];

/** Quota consommé par chaque action : celui de la fonction existante. */
export const LUMEO_ACTION_QUOTA: Record<LumeoActionType, AiUsageKind> = {
  lettre: "lettre",
  resume_offre: "resume_offre",
  adaptation_cv: "cvb_adaptation",
};

/** Demande d'action reçue du navigateur (clic sur « Confirmer ») : schéma strict. */
export const LumeoActionRequestSchema = z
  .object({
    type: z.enum(LUMEO_ACTION_TYPES),
    applicationId: z.string().uuid(),
  })
  .strict();
export type LumeoActionRequest = z.infer<typeof LumeoActionRequestSchema>;

export function parseLumeoActionRequest(value: unknown): LumeoActionRequest | null {
  const parsed = LumeoActionRequestSchema.safeParse(value);
  return parsed.success ? { ...parsed.data, applicationId: parsed.data.applicationId.toLowerCase() } : null;
}

/**
 * Proposition tirée de la réponse du modèle : une action de la liste, sur la fiche ouverte
 * seulement (id de l'emplacement, jamais du modèle). Null : pas de proposition.
 */
export function proposalFromModel(action: unknown, ficheId: string | null): LumeoActionRequest | null {
  if (!ficheId || typeof action !== "string" || !(LUMEO_ACTION_TYPES as readonly string[]).includes(action)) return null;
  return parseLumeoActionRequest({ type: action, applicationId: ficheId });
}

// ---------------------------------------------------------------------------
// Préconditions (relues en base, jamais fournies par le modèle)
// ---------------------------------------------------------------------------

export type LumeoActionFacts = {
  /** Candidature relue avec les droits de l'utilisateur ; null : introuvable ou pas à lui. */
  app: {
    id: string;
    company: string;
    position: string;
    is_example?: boolean;
    offer_description: string | null;
    offer_summary?: string | null;
    cover_letter_html?: string | null;
  } | null;
  /** Un CV du CV Builder est déjà lié à cette candidature. */
  linkedCv: boolean;
  /** CV source de l'adaptation (dernier CV du CV Builder). */
  sourceCv: { title: string; hasBullets: boolean } | null;
  /** Nombre maximum de CV atteint : la copie adaptée ne peut pas être créée. */
  cvLimitReached: boolean;
  /** Un CV est disponible pour la lettre (CV lié, CV Builder ou CV du profil). */
  letterCv: boolean;
  /** Prénom et nom renseignés (signature de la lettre). */
  signer: boolean;
};

export type LumeoRefusal = { ok: false; message: string; link?: { href: string; label: string } };

const offerText = (app: NonNullable<LumeoActionFacts["app"]>) => (app.offer_description ?? "").trim();

/** L'action est-elle possible sur cette candidature ? Sinon, la raison, avec un lien utile. */
export function checkLumeoAction(type: LumeoActionType, facts: LumeoActionFacts): { ok: true } | LumeoRefusal {
  const { app } = facts;
  if (!app) return { ok: false, message: T.notFound };
  if (app.is_example) return { ok: false, message: T.example };
  const fiche = `/candidatures/${app.id}`;
  if (type === "lettre") {
    if (!isEmptyLetterHtml(app.cover_letter_html)) return { ok: false, message: T.letterExists, link: { href: `${fiche}/lettre`, label: T.openLetter } };
    if (!facts.letterCv) return { ok: false, message: T.noCv, link: { href: "/cv-builder", label: T.cvBuilder } };
    if (!facts.signer) return { ok: false, message: T.noName, link: { href: "/profil", label: T.profile } };
  }
  if (type === "resume_offre") {
    if (app.offer_summary?.trim()) return { ok: false, message: T.summaryExists, link: { href: fiche, label: T.openFiche } };
    if (offerText(app).length < SUMMARY_MIN_LENGTH) return { ok: false, message: T.descriptionTooShort, link: { href: fiche, label: T.openFiche } };
  }
  if (type === "adaptation_cv") {
    if (facts.linkedCv) return { ok: false, message: T.cvAlreadyLinked, link: { href: `/cv-builder?applicationId=${app.id}`, label: T.openLinkedCv } };
    if (!facts.sourceCv) return { ok: false, message: T.noCv, link: { href: "/cv-builder", label: T.cvBuilder } };
    if (!facts.sourceCv.hasBullets) return { ok: false, message: T.noBullets, link: { href: "/cv-builder", label: T.cvBuilder } };
    if (facts.cvLimitReached) return { ok: false, message: T.cvLimit, link: { href: "/cv-builder", label: T.cvBuilder } };
    if (!offerText(app) && !app.offer_summary?.trim()) return { ok: false, message: T.descriptionTooShort, link: { href: fiche, label: T.openFiche } };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Carte de confirmation (construite depuis la base, jamais depuis le texte du modèle)
// ---------------------------------------------------------------------------

export type LumeoQuotaState = { premium: boolean; count: AiUsageCount; usedToday: number };

export type LumeoProposal = {
  type: LumeoActionType;
  applicationId: string;
  title: string;
  description: string;
  quota: string;
  /** Quota épuisé : bouton « Confirmer » désactivé, message clair. */
  blocked: string | null;
};

export function lumeoProposalCard(
  request: LumeoActionRequest,
  app: NonNullable<LumeoActionFacts["app"]>,
  sourceCvTitle: string | null,
  quota: LumeoQuotaState,
): LumeoProposal {
  const target = { position: app.position, company: app.company };
  const description =
    request.type === "lettre"
      ? T.cardLetter(target)
      : request.type === "resume_offre"
        ? T.cardSummary(target)
        : T.cardAdaptation({ ...target, cv: sourceCvTitle ?? T.yourCv });
  const unit = T.units[request.type];
  const { used, limit } = quota.count;
  const monthLeft = limit === null ? null : Math.max(0, limit - used);
  const dayLeft = Math.max(0, AI_DAILY_LIMIT - quota.usedToday);
  const quotaLine = quota.premium || limit === null ? T.quotaPremium(AI_DAILY_LIMIT) : T.quotaFree(unit, monthLeft ?? 0, limit);
  const blocked = dayLeft === 0 ? T.dailyReached : monthLeft === 0 ? T.monthReached(unit) : null;
  return { ...request, title: T.cardTitle, description, quota: quotaLine, blocked };
}

// ---------------------------------------------------------------------------
// Exécution après confirmation (dépendances injectées)
// ---------------------------------------------------------------------------

export type LumeoActionDone = { ok: true; message: string; link: { href: string; label: string } };
export type LumeoActionOutcome = LumeoActionDone | (LumeoRefusal & { premium?: boolean });

/** Réservation d'une exécution (une seule à la fois par utilisateur, type et candidature). */
export type LumeoClaim = { type: LumeoActionType; applicationId: string; token?: string };

export type LumeoActionDeps = {
  loadFacts: (request: LumeoActionRequest) => Promise<LumeoActionFacts>;
  /** Contrôle d'accès existant (quota du mois, 50 par jour, 10 par minute). */
  gate: (kind: AiUsageKind) => Promise<{ ok: true } | { ok: false; message: string; limitReached: boolean }>;
  /** Réserve l'exécution ; null si une autre est déjà en cours. */
  claim: (request: LumeoActionRequest) => Promise<LumeoClaim | null>;
  /** Appelle l'IA et enregistre le résultat (lettre, résumé, CV adapté). */
  run: (request: LumeoActionRequest, facts: LumeoActionFacts, claim: LumeoClaim) => Promise<LumeoActionDone | LumeoRefusal>;
  /** Décompte existant (recordAiUsage). */
  record: (kind: AiUsageKind) => Promise<void>;
  /** Libère la réservation après un échec (rien n'a été enregistré). */
  release: (claim: LumeoClaim) => Promise<void>;
  log?: (message: string) => void;
};

/**
 * Exécute une action confirmée : schéma strict, préconditions relues en base, contrôle d'accès,
 * réservation, puis l'action. Le quota de l'action est compté une seule fois, après réussite ;
 * jamais de question à Lumeo. Une deuxième exécution simultanée est refusée sans rien compter.
 */
export async function executeLumeoAction(input: unknown, deps: LumeoActionDeps): Promise<LumeoActionOutcome> {
  const request = parseLumeoActionRequest(input);
  if (!request) return { ok: false, message: T.invalid };
  const facts = await deps.loadFacts(request);
  const check = checkLumeoAction(request.type, facts);
  if (!check.ok) return check;

  const kind = LUMEO_ACTION_QUOTA[request.type];
  const gate = await deps.gate(kind);
  if (!gate.ok) {
    return gate.limitReached
      ? { ok: false, message: T.monthReached(T.units[request.type]), link: { href: "/premium", label: T.premium }, premium: true }
      : { ok: false, message: gate.message };
  }

  let claim: LumeoClaim | null;
  try {
    claim = await deps.claim(request);
  } catch (error) {
    deps.log?.(error instanceof Error ? `${error.name}: ${error.message}` : "erreur inconnue");
    return { ok: false, message: T.failed };
  }
  if (!claim) return { ok: false, message: T.alreadyRunning };

  let result: LumeoActionDone | LumeoRefusal;
  try {
    result = await deps.run(request, facts, claim);
  } catch (error) {
    deps.log?.(error instanceof Error ? `${error.name}: ${error.message}` : "erreur inconnue");
    result = { ok: false, message: T.failed };
  }
  if (!result.ok) {
    await deps.release(claim);
    return result;
  }
  await deps.record(kind);
  return result;
}

/** Carte dans la conversation : proposition et suite (en cours, faite, refusée, annulée). */
export type LumeoProposalState = LumeoProposal & {
  status?: "idle" | "running" | "done" | "failed" | "cancelled";
  outcome?: LumeoActionOutcome;
};

// ---------------------------------------------------------------------------
// Lettre « vide » (aucune lettre) : null, chaîne vide ou texte blanc seulement
// ---------------------------------------------------------------------------

/** Filtres PostgREST d'une lettre vide (ou logique) ; [[:space:]] : espaces, tabulations, sauts de ligne. */
export const LETTER_EMPTY_FILTERS = ["cover_letter_html.is.null", 'cover_letter_html.match."^[[:space:]]*$"'] as const;

/** Équivalent en JS des filtres ci-dessus (préconditions, mode démo, tests). */
export function isEmptyLetterHtml(html: string | null | undefined): boolean {
  return html == null || html.trim() === "";
}

/** Condition « lettre vide » seule (enregistrement, libération). */
export const letterEmptyCondition = () => LETTER_EMPTY_FILTERS.join(",");

/** Réservation : lettre vide ET (pas de réservation, ou réservation périmée). Une seule condition `or`. */
export const letterClaimCondition = (staleBeforeIso: string) =>
  LETTER_EMPTY_FILTERS.flatMap((empty) => [`and(${empty},cover_letter_at.is.null)`, `and(${empty},cover_letter_at.lt."${staleBeforeIso}")`]).join(",");

/**
 * Lettre de Lumeo : rédigée, puis enregistrée seulement si aucune lettre n'existe au moment de
 * l'écriture (condition atomique côté base). Sinon : refus avec lien, rien n'est écrasé ; le
 * refus fait libérer la réservation et ne décompte rien (executeLumeoAction).
 */
export async function writeLetterIfEmpty(
  applicationId: string,
  ops: { generate: () => Promise<string | null>; saveIfEmpty: (html: string) => Promise<boolean> },
): Promise<LumeoActionDone | LumeoRefusal> {
  const fiche = `/candidatures/${applicationId}`;
  const html = await ops.generate();
  if (!html) return { ok: false, message: T.failed };
  if (!(await ops.saveIfEmpty(html))) return { ok: false, message: T.letterExists, link: { href: `${fiche}/lettre`, label: T.openLetter } };
  return { ok: true, message: T.done, link: { href: `${fiche}/lettre`, label: T.openLetter } };
}

/**
 * Adaptation : copie du CV créée puis liée à la candidature (réservation par l'index unique).
 * Si la liaison échoue (CV déjà lié, ou erreur inattendue), la copie est toujours supprimée ;
 * une erreur inattendue est ensuite remontée (l'action s'arrête sans IA ni décompte).
 */
export async function claimAdaptationCopy(ops: {
  createCopy: () => Promise<string>;
  link: (copyId: string) => Promise<boolean>;
  deleteCopy: (copyId: string) => Promise<void>;
}): Promise<string | null> {
  const copyId = await ops.createCopy();
  let linked = false;
  try {
    linked = await ops.link(copyId);
  } finally {
    if (!linked) await ops.deleteCopy(copyId).catch(() => {});
  }
  return linked ? copyId : null;
}
