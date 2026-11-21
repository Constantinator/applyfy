// Parcours d'accueil (/bienvenue, puis phase guidée du CV Builder) : écrans, barre de progression,
// reprise, date de coupure et statistiques (fonctions pures, testables). Valeurs alignées avec les
// migrations 0045 et 0047.

/**
 * Mise en ligne du parcours : seuls les comptes créés à partir de cet instant le suivent. Les
 * comptes plus anciens ne le voient jamais.
 */
export const ONBOARDING_LAUNCHED_AT = "2026-11-20T22:00:00Z";

/** Écrans de /bienvenue (migration 0045) ; chemin A : « chemin_cv », chemin B : « chemin_offre ». */
export const ONBOARDING_SCREENS = ["accueil", "apport", "temps", "cv", "chemin_cv", "chemin_offre"] as const;
export type OnboardingScreen = (typeof ONBOARDING_SCREENS)[number];

/**
 * Phase guidée du chemin A (migration 0047) : améliorer le CV dans l'éditeur, le télécharger,
 * puis ajouter une offre.
 */
export const GUIDE_STEPS = ["guide_cv", "guide_telecharger", "guide_offre"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];
/** Étapes de la phase guidée qui se passent dans l'éditeur du CV Builder. */
export type GuideEditorStep = Extract<GuideStep, "guide_cv" | "guide_telecharger">;

/** Toutes les étapes connues de la base, dans l'ordre du parcours. */
export const ONBOARDING_STEPS = [...ONBOARDING_SCREENS, ...GUIDE_STEPS] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const isGuideStep = (step: unknown): step is GuideStep =>
  typeof step === "string" && (GUIDE_STEPS as readonly string[]).includes(step);

/** Barre de progression : 4 segments (écran 1 ; écrans 2 et 2 bis ; écran 3 ; chemin A ou B). */
export const ONBOARDING_SEGMENTS = 4;
const SEGMENT_OF: Record<OnboardingStep, number> = {
  accueil: 1,
  apport: 2,
  temps: 2,
  cv: 3,
  chemin_cv: 4,
  chemin_offre: 4,
  guide_cv: 4,
  guide_telecharger: 4,
  guide_offre: 4,
};
export const segmentOf = (step: OnboardingStep) => SEGMENT_OF[step];

export type JobSearch = "oui" | "pas_encore";
export type HasCv = "oui" | "plus_tard";
/** Action choisie sur un chemin : A (import, zero) ou B (lien, recherche). */
export const ONBOARDING_CHOICES = ["import", "zero", "lien", "recherche"] as const;
export type OnboardingChoice = (typeof ONBOARDING_CHOICES)[number];

/** Ce que le parcours enregistre (une ligne par compte). */
export type OnboardingState = {
  step: OnboardingStep;
  jobSearch: JobSearch | null;
  hasCv: HasCv | null;
  choice: OnboardingChoice | null;
  skipped: OnboardingStep[];
};

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: "accueil",
  jobSearch: null,
  hasCv: null,
  choice: null,
  skipped: [],
};

/**
 * Écran suivant, ou null : le parcours est terminé (tableau de bord). Après l'écran 3 : chemin A
 * si la personne a un CV, chemin B sinon (« Plus tard » ou écran passé).
 */
export function nextScreen(step: OnboardingScreen, hasCv: HasCv | null = null): OnboardingScreen | null {
  switch (step) {
    case "accueil":
      return "apport";
    case "apport":
      return "temps";
    case "temps":
      return "cv";
    case "cv":
      return hasCv === "oui" ? "chemin_cv" : "chemin_offre";
    default:
      return null;
  }
}

/**
 * Écran de /bienvenue où reprendre : celui enregistré ; pendant la phase guidée sans CV à ouvrir,
 * le choix « importer ou créer » (chemin A) ; l'écran 1 sinon.
 */
export function resumeScreen(step: OnboardingStep | null | undefined): OnboardingScreen {
  if (isGuideStep(step)) return step === "guide_offre" ? "chemin_offre" : "chemin_cv";
  return step && (ONBOARDING_SCREENS as readonly string[]).includes(step) ? (step as OnboardingScreen) : "accueil";
}

export type ResumeTarget =
  | { kind: "bienvenue"; screen: OnboardingScreen }
  | { kind: "editeur"; cvId: string }
  /** Phase guidée, étape 3 : écran « Quelle offre t'intéresse ? » de /bienvenue. */
  | { kind: "offre" };

/**
 * Où reprendre le parcours : l'éditeur du dernier CV pendant la phase guidée (s'il existe), sinon
 * l'écran de /bienvenue.
 */
export function resumeTarget(step: OnboardingStep | null | undefined, latestCvId: string | null): ResumeTarget {
  if ((step === "guide_cv" || step === "guide_telecharger") && latestCvId) return { kind: "editeur", cvId: latestCvId };
  if (step === "guide_offre") return { kind: "offre" };
  return { kind: "bienvenue", screen: resumeScreen(step) };
}

/**
 * Éditeur en mode guidé ? Seulement pour un compte créé après la mise en ligne, parcours ni
 * terminé ni passé, phase guidée en cours, et sur le dernier CV de la personne. Sinon null :
 * l'éditeur reste tel qu'avant (jamais de verrou pour un ancien compte).
 */
export function guidedEditorStep(input: {
  createdAt: string | null | undefined;
  metadataCompleted: boolean;
  doneCookie: boolean;
  progress: { step: string; completed: boolean } | null;
  cvId: string;
  latestCvId: string | null;
}): GuideEditorStep | null {
  const step = guidedPhaseStep(input);
  return step && input.cvId === input.latestCvId ? step : null;
}

/**
 * Phase guidée en cours (import, création ou éditeur) : l'étape 1 ou 2, ou null. Seulement pour un
 * compte créé après la mise en ligne, parcours ni terminé ni passé. Sert au verrou des pages
 * d'import et de création (pas de condition de CV : il n'existe pas encore).
 */
export function guidedPhaseStep(input: {
  createdAt: string | null | undefined;
  metadataCompleted: boolean;
  doneCookie: boolean;
  progress: { step: string; completed: boolean } | null;
}): GuideEditorStep | null {
  if (!isAfterLaunch(input.createdAt) || input.metadataCompleted || input.doneCookie) return null;
  if (!input.progress || input.progress.completed) return null;
  return input.progress.step === "guide_cv" || input.progress.step === "guide_telecharger" ? input.progress.step : null;
}

/** Destination de chaque action des chemins A et B. `link` : lien d'offre déjà validé. */
export function choiceDestination(choice: OnboardingChoice, link = ""): string {
  switch (choice) {
    case "import":
      return "/cv-builder/importer";
    case "zero":
      return "/cv-builder?nouveau=1";
    case "lien":
      return `/candidatures/nouvelle?lien=${encodeURIComponent(link)}`;
    case "recherche":
      return "/offres";
  }
}

/**
 * Phase guidée, écran de l'offre : le formulaire de candidature avec le lien, et `accueil=1` pour
 * que la création de la candidature termine le parcours (vérifié côté serveur).
 */
export function guideOfferDestination(link: string): string {
  return `/candidatures/nouvelle?lien=${encodeURIComponent(link)}&accueil=1`;
}

/** « Passer » : l'écran est noté comme passé (une seule fois). */
export function withSkipped(state: OnboardingState, step: OnboardingStep): OnboardingState {
  return state.skipped.includes(step) ? state : { ...state, skipped: [...state.skipped, step] };
}

/** Compte assez récent pour suivre le parcours (créé à partir de la mise en ligne). */
export function isAfterLaunch(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return !Number.isNaN(created) && created >= Date.parse(ONBOARDING_LAUNCHED_AT);
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

/** État reçu du navigateur, validé ; null s'il est invalide. */
export function parseOnboardingState(input: unknown): OnboardingState | null {
  const data = (input ?? {}) as Record<string, unknown>;
  if (!isOneOf(ONBOARDING_STEPS, data.step)) return null;
  const jobSearch = data.jobSearch ?? null;
  const hasCv = data.hasCv ?? null;
  const choice = data.choice ?? null;
  if (jobSearch !== null && !isOneOf(["oui", "pas_encore"] as const, jobSearch)) return null;
  if (hasCv !== null && !isOneOf(["oui", "plus_tard"] as const, hasCv)) return null;
  if (choice !== null && !isOneOf(ONBOARDING_CHOICES, choice)) return null;
  if (!Array.isArray(data.skipped) || data.skipped.length > ONBOARDING_STEPS.length) return null;
  if (!data.skipped.every((step) => isOneOf(ONBOARDING_STEPS, step))) return null;
  return {
    step: data.step,
    jobSearch: jobSearch as JobSearch | null,
    hasCv: hasCv as HasCv | null,
    choice: choice as OnboardingChoice | null,
    skipped: [...new Set(data.skipped as OnboardingStep[])],
  };
}

/** Ligne de la table onboarding_progress, telle que lue par l'admin. */
export type OnboardingRow = {
  step: OnboardingStep;
  job_search: JobSearch | null;
  has_cv: HasCv | null;
  choice: OnboardingChoice | null;
  skipped_steps: OnboardingStep[];
  completed_at: string | null;
};

export type OnboardingStats = {
  /** Comptes créés depuis la mise en ligne. */
  signups: number;
  started: number;
  completed: number;
  /** Parcours en cours, par étape où la personne s'est arrêtée. */
  stoppedAt: Record<OnboardingStep, number>;
  jobSearch: { oui: number; pas_encore: number; sans_reponse: number };
  hasCv: { oui: number; plus_tard: number; sans_reponse: number };
  /** Action choisie en fin de parcours (chemins A et B). */
  choice: Record<OnboardingChoice | "aucune", number>;
  /** Nombre de fois où chaque étape a été passée. */
  skipped: Record<OnboardingStep, number>;
};

const zeroByScreen = () => Object.fromEntries(ONBOARDING_STEPS.map((s) => [s, 0])) as Record<OnboardingStep, number>;

/** Statistiques du parcours (/admin). */
export function onboardingStats(rows: OnboardingRow[], signups: number): OnboardingStats {
  const stats: OnboardingStats = {
    signups,
    started: rows.length,
    completed: 0,
    stoppedAt: zeroByScreen(),
    jobSearch: { oui: 0, pas_encore: 0, sans_reponse: 0 },
    hasCv: { oui: 0, plus_tard: 0, sans_reponse: 0 },
    choice: { import: 0, zero: 0, lien: 0, recherche: 0, aucune: 0 },
    skipped: zeroByScreen(),
  };
  for (const row of rows) {
    if (row.completed_at) stats.completed++;
    else stats.stoppedAt[(ONBOARDING_STEPS as readonly string[]).includes(row.step) ? row.step : "accueil"]++;
    stats.jobSearch[row.job_search ?? "sans_reponse"]++;
    stats.hasCv[row.has_cv ?? "sans_reponse"]++;
    stats.choice[row.choice ?? "aucune"]++;
    for (const step of row.skipped_steps) {
      if (step in stats.skipped) stats.skipped[step]++;
    }
  }
  return stats;
}

/** Progression lue en base pour un e-mail : null sans ligne, « illisible » si la lecture échoue. */
export type OnboardingProgressRead = { completed: boolean } | null | "illisible";

/**
 * Variante des e-mails d'accueil : « en_cours » seulement si le parcours concerne ce compte (créé
 * après la mise en ligne) et n'est pas terminé. Lecture impossible ou table absente : « fini »,
 * la variante neutre.
 */
export function onboardingEmailVariant(input: {
  createdAt: string | null | undefined;
  metadataCompleted: boolean;
  progress: OnboardingProgressRead;
}): "en_cours" | "fini" {
  if (!isAfterLaunch(input.createdAt) || input.metadataCompleted) return "fini";
  if (input.progress === "illisible" || input.progress?.completed) return "fini";
  return "en_cours";
}
