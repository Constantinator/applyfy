// Ce que promettent les plans : uniquement ce que le code fait aujourd'hui. Les nombres viennent
// des constantes des quotas (voir plan-features.test.mjs), jamais écrits ici. Premium : mêmes
// droits pour les deux offres, seule la facturation change.
import {
  AI_DAILY_LIMIT,
  AI_MONTHLY_LIMITS as L,
  AI_RATE_LIMIT_PER_MINUTE,
  CVB_COACH_DAILY_LIMIT,
} from "./ai-usage-limits";
import { CV_BUILDER_MAX } from "./cv-builder-types";

/** « 1 résumé », « 2 résumés ». */
export const countLabel = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const ADAPTATIONS = `${countLabel(L.cvb_chat, "adaptation de CV", "adaptations de CV")} par mois`;
const COACH = `${countLabel(CVB_COACH_DAILY_LIMIT, "question au coach", "questions au coach")} par jour`;
const IMPORTS = `${countLabel(L.cvb_import, "import de CV", "imports de CV")} par mois`;
const COACH_LIFTED = `Plus de limite de ${countLabel(CVB_COACH_DAILY_LIMIT, "question", "questions")} par jour au coach`;

/** Plan gratuit, page Premium. */
export const FREE_FEATURES = [
  ADAPTATIONS,
  COACH,
  IMPORTS,
  `${countLabel(L.resume_offre, "résumé d'offre", "résumés d'offre")} par mois à l'ajout d'une candidature`,
  `${countLabel(L.resume_recherche, "résumé d'offre", "résumés d'offre")} par mois dans « Trouver une offre »`,
  `${countLabel(L.lettre, "lettre", "lettres")} de motivation par mois (génération ou import)`,
  `${countLabel(L.affinage_lettre, "message", "messages")} par mois au chat d'affinage de la lettre`,
  "Suivi de toutes tes candidatures, tableau de bord, rappels de relance",
];

/** Offres Premium, page Premium. */
export const PREMIUM_FEATURES = [
  "Adaptations de CV sans quota mensuel",
  COACH_LIFTED,
  "Imports de CV sans quota mensuel",
  "Résumés d'offre sans quota mensuel",
  "Lettres de motivation et chat d'affinage sans quota mensuel",
];

export const PLAN_LIMITS_NOTE = `Pour tous les plans : ${AI_DAILY_LIMIT} actions IA par jour, ${AI_RATE_LIMIT_PER_MINUTE} requêtes par minute et ${CV_BUILDER_MAX} CV au maximum.`;

export const RESET_NOTE ="Le coach repart à zéro chaque jour à minuit. Les autres compteurs, le 1er de chaque mois.";
