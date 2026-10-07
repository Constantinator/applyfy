// Programme beta testeurs : règles partagées entre les pages (serveur), les formulaires
// (client), la tâche quotidienne et la base (migration 0017 : garder les deux alignées).

/** Nombre maximum de beta testeurs actifs. */
export const BETA_MAX_TESTERS = 30;
/** Fin du Premium offert aux beta testeurs (inclus). */
export const BETA_PREMIUM_UNTIL = "2026-12-31";
export const BETA_PREMIUM_UNTIL_LABEL = "31 décembre 2026";
/** Rappel envoyé ce nombre de jours avant la date limite d'un rapport. */
export const BETA_REMINDER_DAYS_BEFORE = 2;

export type BetaStatus = "active" | "suspended" | "removed";

export const BETA_STATUS_LABELS: Record<BetaStatus, string> = {
  active: "Actif",
  suspended: "Suspendu",
  removed: "Retiré",
};

type TextField = { name: string; label: string; kind: "text"; required: boolean; placeholder: string };
type RatingField = { name: string; label: string; kind: "rating10"; required: true };
type RecommendField = { name: string; label: string; kind: "recommend"; required: true };
export type BetaReportField = TextField | RatingField | RecommendField;

export type BetaReportDefinition = {
  number: 1 | 2 | 3;
  title: string;
  period: string;
  /** Date limite : jours après l'inscription. */
  dueDays: number;
  fields: BetaReportField[];
};

export const BETA_TEXT_MAX_LENGTH = 3000;

export const BETA_RECOMMEND_OPTIONS = { oui: "Oui", peut_etre: "Peut-être", non: "Non" } as const;

export const BETA_REPORTS: BetaReportDefinition[] = [
  {
    number: 1,
    title: "Rapport 1",
    period: "Semaine 1",
    dueDays: 7,
    fields: [
      {
        name: "bugs",
        label: "Bugs trouvés",
        kind: "text",
        required: true,
        placeholder: "Ce qui ne marche pas, sur quelle page, ce que tu faisais… (écris « aucun » s'il n'y en a pas)",
      },
      {
        name: "first_impression",
        label: "Première impression",
        kind: "text",
        required: true,
        placeholder: "Ce qui t'a plu, surpris ou gêné en découvrant Applyfy.",
      },
    ],
  },
  {
    number: 2,
    title: "Rapport 2",
    period: "Semaine 2",
    dueDays: 14,
    fields: [
      {
        name: "missing_features",
        label: "Fonctionnalités manquantes",
        kind: "text",
        required: true,
        placeholder: "Ce qui t'a manqué dans ta recherche d'emploi.",
      },
      {
        name: "suggestions",
        label: "Suggestions",
        kind: "text",
        required: true,
        placeholder: "Ce qu'on pourrait améliorer en priorité.",
      },
    ],
  },
  {
    number: 3,
    title: "Rapport 3",
    period: "Mois 1",
    dueDays: 30,
    fields: [
      {
        name: "summary",
        label: "Bilan global",
        kind: "text",
        required: true,
        placeholder: "Ton bilan après un mois : ce qu'Applyfy t'a apporté, ce qui reste à faire.",
      },
      { name: "rating", label: "Note globale sur 10", kind: "rating10", required: true },
      { name: "recommend", label: "Recommanderais-tu Applyfy ?", kind: "recommend", required: true },
    ],
  },
];

export type BetaReportAnswers = Record<string, string | number>;

const DAY = 86_400_000;

/** Date limite d'un rapport (ISO), calculée comme beta_report_deadline (migration 0017). */
export function reportDeadline(joinedAt: string, number: number): Date {
  const def = BETA_REPORTS[number - 1];
  return new Date(new Date(joinedAt).getTime() + def.dueDays * DAY);
}

/** Ouverture d'un rapport : la date limite du précédent (l'inscription pour le 1er). */
export function reportOpensAt(joinedAt: string, number: number): Date {
  return number === 1 ? new Date(joinedAt) : reportDeadline(joinedAt, number - 1);
}

export type BetaReportStatus = "a_venir" | "a_faire" | "soumis" | "en_retard";

export const BETA_REPORT_STATUS_LABELS: Record<BetaReportStatus, string> = {
  a_venir: "À venir",
  a_faire: "À faire",
  soumis: "Soumis",
  en_retard: "En retard",
};

export function reportStatus(
  joinedAt: string,
  number: number,
  submittedAt: string | null,
  now = new Date(),
): BetaReportStatus {
  if (submittedAt) return "soumis";
  if (now > reportDeadline(joinedAt, number)) return "en_retard";
  if (now < reportOpensAt(joinedAt, number)) return "a_venir";
  return "a_faire";
}

/** Réponses valides d'un rapport (reçues du navigateur), ou message d'erreur. */
export function parseReportAnswers(number: number, input: unknown): BetaReportAnswers | string {
  const def = BETA_REPORTS[number - 1];
  if (!def) return "Rapport inconnu.";
  const data = (input ?? {}) as Record<string, unknown>;
  const answers: BetaReportAnswers = {};
  for (const field of def.fields) {
    const value = data[field.name];
    if (field.kind === "text") {
      const text = typeof value === "string" ? value.trim() : "";
      if (field.required && !text) return `Réponds à « ${field.label} ».`;
      if (text.length > BETA_TEXT_MAX_LENGTH) return `« ${field.label} » est trop long (3 000 caractères max).`;
      answers[field.name] = text;
    } else if (field.kind === "rating10") {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) return "Donne une note de 1 à 10.";
      answers[field.name] = rating;
    } else {
      if (typeof value !== "string" || !Object.hasOwn(BETA_RECOMMEND_OPTIONS, value)) {
        return "Dis-nous si tu recommanderais Applyfy.";
      }
      answers[field.name] = value;
    }
  }
  return answers;
}

/** Réponse lisible (tableau de bord admin, profil). */
export function formatAnswer(field: BetaReportField, value: string | number | undefined): string {
  if (value === undefined || value === "") return "—";
  if (field.kind === "rating10") return `${value}/10`;
  if (field.kind === "recommend") return BETA_RECOMMEND_OPTIONS[value as keyof typeof BETA_RECOMMEND_OPTIONS] ?? String(value);
  return String(value);
}
