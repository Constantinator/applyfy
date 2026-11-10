// Ce que promettent les plans, pour /premium et la landing : uniquement ce que le code fait
// aujourd'hui, avec le nom que l'utilisateur voit dans l'app (« Lumeo » : ses questions, partagées
// avec le coach du CV Builder). Les nombres viennent des constantes des quotas (voir
// plan-features.test.mjs), jamais écrits ici.
// Premium : mêmes droits pour les deux offres, seule la facturation change.
import {
  AI_DAILY_LIMIT,
  AI_MONTHLY_LIMITS as L,
  AI_RATE_LIMIT_PER_MINUTE,
  CVB_COACH_DAILY_LIMIT,
  PREMIUM_PRICE_MONTHLY,
  PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY,
  PREMIUM_PRICE_QUARTERLY,
} from "./ai-usage-limits";
import { BETA_PREMIUM_UNTIL_LABEL } from "./beta-rules";
import { CV_BUILDER_MAX } from "./cv-builder-types";

/** Prix du Premium (euros TTC) et fin du Premium offert aux beta testeurs, lus aux constantes. */
export const PLAN_PRICES = {
  monthly: PREMIUM_PRICE_MONTHLY,
  quarterly: PREMIUM_PRICE_QUARTERLY,
  quarterlyPerMonth: PREMIUM_PRICE_MONTHLY_EQUIVALENT_QUARTERLY,
  betaUntil: BETA_PREMIUM_UNTIL_LABEL,
} as const;

/** « 1 résumé », « 2 résumés ». */
export const countLabel = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const COACH_QUESTIONS = countLabel(CVB_COACH_DAILY_LIMIT, "question", "questions");

export const FREE_FEATURES = [
  `Lumeo : ${COACH_QUESTIONS} par jour`,
  `Adaptation de CV : ${L.cvb_chat} par mois`,
  `Import de CV : ${L.cvb_import} par mois`,
  // Quatre compteurs de même valeur (vérifié par le test) : d'où « par outil ».
  `Lettres de motivation et résumés d'offre : ${L.lettre} par mois par outil`,
  "Suivi des candidatures, tableau de bord et rappels de relance",
];

export const PREMIUM_FEATURES = [
  "Tout le plan gratuit",
  `Lumeo : plus de limite de ${COACH_QUESTIONS} par jour`,
  "Adaptation et import de CV : sans quota mensuel",
  "Lettres et résumés d'offre : sans quota mensuel",
];

/** Carte « 3 mois » : mêmes droits que le mensuel (voir l'en-tête), seule la facturation change. */
export const QUARTERLY_FEATURES = [
  "Tout Premium mensuel",
  "Le meilleur prix par mois",
  "Mêmes droits, seule la facturation change",
];

/** Réponse de la FAQ « Qu'est-ce qui est gratuit ? » de la landing. */
export const LANDING_FREE_ANSWER = `Le plan gratuit inclut le suivi de tes candidatures, le tableau de bord, les rappels de relance, ${COACH_QUESTIONS} par jour à Lumeo, ${countLabel(L.cvb_chat, "adaptation", "adaptations")} et ${countLabel(L.cvb_import, "import", "imports")} de CV par mois, et ${L.lettre} usage par mois de chaque outil de lettre et de résumé d'offre. Aucune carte bancaire requise.`;

export const PLAN_LIMITS_NOTE = `Pour tous les plans : ${AI_DAILY_LIMIT} actions IA par jour, ${AI_RATE_LIMIT_PER_MINUTE} requêtes par minute et ${CV_BUILDER_MAX} CV au maximum.`;

export const RESET_NOTE = "Les questions à Lumeo repartent à zéro chaque jour à minuit. Les autres compteurs, le 1er de chaque mois.";
