// Ce que Lumeo sait de l'offre Applyfy et de l'appli (fonctions pures, testables) : plans, prix et
// limites construits depuis la source unique (lib/plan-features, elle-même lue aux constantes des
// quotas), plan et quotas restants de l'utilisateur, et une courte fiche des fonctions. Aucun
// nombre n'est écrit ici : tout vient des constantes (vérifié par le test).
import {
  AI_DAILY_LIMIT,
  AI_USAGE_LABELS,
  CVB_COACH_DAILY_LIMIT,
  type AiUsageCount,
  type AiUsageKind,
} from "./ai-usage-limits";
import { CV_BUILDER_MAX, CV_IMPORT_MAX_LABEL, CV_TEMPLATES } from "./cv-builder-types";
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from "./dashboard-week";
import { FOLLOW_UP_AFTER_DAYS } from "./follow-up";
import {
  FREE_FEATURES,
  PLAN_LIMITS_NOTE,
  PLAN_PRICES,
  PREMIUM_FEATURES,
  QUARTERLY_FEATURES,
  RESET_NOTE,
} from "./plan-features";
import { DEFAULT_REMINDER_SETTINGS, FIRST_REMINDER_OPTIONS, MAX_REMINDERS, SECOND_REMINDER_OPTIONS } from "./reminders";

// ---------------------------------------------------------------------------
// Plans et prix (source : lib/plan-features)
// ---------------------------------------------------------------------------

export type PlanSource = {
  free: readonly string[];
  premium: readonly string[];
  quarterly: readonly string[];
  prices: { monthly: number; quarterly: number; quarterlyPerMonth: number; betaUntil: string };
  limitsNote: string;
  resetNote: string;
};

export const DEFAULT_PLAN_SOURCE: PlanSource = {
  free: FREE_FEATURES,
  premium: PREMIUM_FEATURES,
  quarterly: QUARTERLY_FEATURES,
  prices: PLAN_PRICES,
  limitsNote: PLAN_LIMITS_NOTE,
  resetNote: RESET_NOTE,
};

/** Offre Applyfy : plans, prix, ce que chacun inclut et limites communes. */
export function lumeoPlansBlock(source: PlanSource = DEFAULT_PLAN_SOURCE): string {
  const { prices } = source;
  const months = Math.round(prices.quarterly / prices.quarterlyPerMonth);
  return [
    "Plan gratuit (aucune carte bancaire) :",
    ...source.free.map((f) => `- ${f}`),
    `Premium mensuel : ${prices.monthly} € par mois, sans engagement :`,
    ...source.premium.map((f) => `- ${f}`),
    `Premium ${months} mois : ${prices.quarterly} € tous les ${months} mois (soit ${prices.quarterlyPerMonth} € par mois), renouvelable :`,
    ...source.quarterly.map((f) => `- ${f}`),
    `Beta testeurs : mêmes droits que Premium, offerts jusqu'au ${prices.betaUntil}.`,
    source.limitsNote,
    source.resetNote,
    "Détails et souscription : page Premium (/premium).",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Plan et quotas restants de l'utilisateur
// ---------------------------------------------------------------------------

export type LumeoPlanKind = "gratuit" | "premium" | "beta";

export type LumeoUserPlanInput = {
  kind: LumeoPlanKind;
  /** Utilisation du mois par type (limit null : pas de quota mensuel). */
  counts: Record<AiUsageKind, AiUsageCount>;
  /** Actions IA du jour, tous types confondus, question en cours comprise. */
  usedToday: number;
  /** Questions à Lumeo (et au coach du CV Builder) aujourd'hui, question en cours comprise. */
  coachToday: number;
};

/** Plan de l'utilisateur : beta active d'abord, puis Premium, sinon gratuit. */
export function lumeoPlanKind({ premium, betaActive }: { premium: boolean; betaActive: boolean }): LumeoPlanKind {
  if (betaActive) return "beta";
  return premium ? "premium" : "gratuit";
}

const left = (limit: number, used: number) => Math.max(0, limit - used);

/**
 * Quotas mensuels donnés à Lumeo : ceux que présente l'offre (lib/plan-features : adaptations,
 * imports, lettres et résumés d'offre). Les compteurs d'anciennes fonctions sans interface
 * (analyse de CV, ancien éditeur) n'y figurent pas, pour qu'il ne les annonce jamais.
 */
export const LUMEO_MONTHLY_QUOTA_KINDS = [
  "cvb_chat",
  "cvb_import",
  "lettre",
  "affinage_lettre",
  "resume_offre",
  "resume_recherche",
] as const satisfies readonly AiUsageKind[];

/** Plan et quotas restants réels (aucune donnée personnelle : seulement des nombres). */
export function lumeoUserPlanBlock({ kind, counts, usedToday, coachToday }: LumeoUserPlanInput): string {
  const free = kind === "gratuit";
  const plan =
    kind === "beta"
      ? `Beta testeur : droits Premium offerts jusqu'au ${PLAN_PRICES.betaUntil}.`
      : kind === "premium"
        ? "Premium (abonnement en cours)."
        : "Gratuit.";
  const monthly = free
    ? LUMEO_MONTHLY_QUOTA_KINDS.filter((k) => counts[k].limit !== null).map((k) => {
        const { used, limit } = counts[k];
        return `- ${AI_USAGE_LABELS[k].title} : ${left(limit ?? 0, used)} restant(s) sur ${limit}`;
      })
    : [];
  return [
    `Plan : ${plan}`,
    free
      ? `Questions à Lumeo aujourd'hui : ${left(CVB_COACH_DAILY_LIMIT, coachToday)} restante(s) sur ${CVB_COACH_DAILY_LIMIT} après cette question (partagées avec le coach du CV Builder ; ça repart à minuit).`
      : "Questions à Lumeo aujourd'hui : pas de quota propre, seulement le plafond commun ci-dessous.",
    `Actions IA aujourd'hui (tous types) : ${left(AI_DAILY_LIMIT, usedToday)} restante(s) sur ${AI_DAILY_LIMIT} après cette question.`,
    ...(free ? ["Ce mois-ci :", ...monthly] : ["Ce mois-ci : pas de quota mensuel."]),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Fiche des fonctions de l'appli (courte, sans détail inventé)
// ---------------------------------------------------------------------------

export const LUMEO_APP_GUIDE = [
  `CV Builder (/cv-builder) : crée un CV de zéro ou à partir d'un CV existant, avec ${CV_TEMPLATES.length} modèles au choix. Un score indique les points à corriger, et Lumeo, dans l'éditeur, pose des questions et met le CV à jour. Téléchargement en PDF. Jusqu'à ${CV_BUILDER_MAX} CV.`,
  `Import de CV : dans le CV Builder, « Créer un CV à partir d'un CV existant », fichier PDF ou Word (.docx), ${CV_IMPORT_MAX_LABEL} maximum. Le contenu est repris dans l'éditeur avec une analyse ; le fichier est supprimé dès qu'il est lu.`,
  "Adaptation à une offre : sur la fiche d'une candidature, « Adapter mon CV à l'offre » ouvre le CV Builder pour préparer un CV lié à cette candidature ; Lumeo tient alors compte des mots-clés de l'offre.",
  "Lettre de motivation : sur la fiche, « Générer ma lettre » rédige une lettre à partir de l'offre et du CV. « Ouvrir l'éditeur de lettre » permet de commencer de zéro, de s'aider du CV en cours ou d'importer une lettre existante ; un chat aide à l'affiner, puis export en PDF.",
  "Résumé d'offre : « Générer un résumé » à l'ajout d'une candidature et dans « Trouver une offre » donne une version lisible de l'annonce, affichée sur la fiche.",
  `Relances et rappels : une candidature envoyée ou en attente est à relancer après ${FOLLOW_UP_AFTER_DAYS} jours sans nouvelles (filtre « À relancer » de Candidatures). Sur la fiche, un message de relance prérempli : le copier ou l'ouvrir dans sa messagerie, puis « Marquer comme relancée ». Rappels par e-mail réglables dans Mon profil : premier rappel après ${FIRST_REMINDER_OPTIONS.join(", ")} jours (par défaut ${DEFAULT_REMINDER_SETTINGS.firstDays}), second après ${SECOND_REMINDER_OPTIONS.join(", ")} jours (par défaut ${DEFAULT_REMINDER_SETTINGS.secondDays}), ${MAX_REMINDERS} au plus. Applyfy n'envoie jamais de relance à la place de l'utilisateur. Lumeo peut retravailler ce message (plus chaleureux, adapté au poste et au délai, sans rien inventer), après confirmation : demandé dans le panneau, c'est compris dans la question ; avec le bouton « Améliorer avec Lumeo » de la boîte Relancer, ça compte une question à Lumeo (${CVB_COACH_DAILY_LIMIT} par jour en gratuit). Le texte se copie ; rien n'est envoyé ni enregistré.`,
  `Objectif de la semaine : sur le Tableau de bord (« Ma semaine »), l'utilisateur fixe un nombre de candidatures à envoyer par semaine, entre ${WEEKLY_GOAL_MIN} et ${WEEKLY_GOAL_MAX} ; la progression s'affiche, avec « Objectif tenu » une fois atteint.`,
  "Extension Chrome (/extension) : gratuite, sur le Chrome Web Store. Quand l'utilisateur colle dans Applyfy le lien d'une offre ouverte dans un autre onglet (LinkedIn, JobTeaser, Indeed, Welcome to the Jungle, page carrière), elle lit la page pour remplir entreprise, poste, lieu et description. Elle ne lit aucun autre onglet.",
].map((line) => `- ${line}`).join("\n");
