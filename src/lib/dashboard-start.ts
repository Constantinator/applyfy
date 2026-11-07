// Bloc « Pour bien démarrer » du tableau de bord (fonctions pures, testables). Jamais la
// candidature exemple : elle est créée à l'inscription, sans action de l'utilisateur.
import { READY_SCORE } from "./cv-score";
import type { Application } from "./types";

/** Au-delà, le compte n'est plus « nouveau » : le bloc n'est plus proposé. */
export const NEW_ACCOUNT_DAYS = 30;

const DAY = 86_400_000;

export type StartStep = { id: string; label: string; href: string; done: boolean };

/** Extension : installée, à installer, ou impossible à installer dans ce navigateur. */
export type ExtensionState = "installed" | "missing" | "unavailable";

export function isNewAccount(createdAt: string | null, now: Date): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return !Number.isNaN(created) && now.getTime() - created < NEW_ACCOUNT_DAYS * DAY;
}

/** Étapes connues du serveur. `cv` : dernier CV modifié et son score, null s'il n'y en a pas. */
export function buildStartSteps(cv: { id: string; score: number } | null, applications: Application[]): StartStep[] {
  const real = applications.filter((app) => !app.is_example);
  const draft = real.find((app) => app.status === "brouillon");
  return [
    { id: "cv", label: "Crée ou importe ton CV", href: "/cv-builder", done: cv !== null },
    {
      id: "score",
      label: `Atteins ${READY_SCORE}/100 sur ton CV`,
      href: cv ? `/cv-builder/${cv.id}?onglet=chat` : "/cv-builder",
      done: cv !== null && cv.score >= READY_SCORE,
    },
    { id: "candidature", label: "Ajoute ta première candidature", href: "/candidatures/nouvelle", done: real.length > 0 },
    {
      id: "envoi",
      label: "Marque une candidature « envoyée »",
      href: draft ? `/candidatures/${draft.id}` : real.length > 0 ? "/candidatures" : "/candidatures/nouvelle",
      done: real.some((app) => app.status !== "brouillon"),
    },
  ];
}

/** Ajoute l'étape de l'extension, sauf si elle ne peut pas être installée ici. */
export function withExtensionStep(steps: StartStep[], extension: ExtensionState): StartStep[] {
  if (extension === "unavailable") return steps;
  return [...steps, { id: "extension", label: "Installe l'extension Chrome", href: "/extension", done: extension === "installed" }];
}

/** La fiche du Chrome Web Store ne sert qu'aux navigateurs Chromium sur ordinateur. */
export function canInstallExtension(userAgent: string): boolean {
  return /Chrome|Chromium/.test(userAgent) && !/Mobi|Android/.test(userAgent);
}

export function startProgress(steps: StartStep[]) {
  const done = steps.filter((step) => step.done).length;
  return {
    done,
    total: steps.length,
    percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
    complete: done === steps.length,
  };
}
