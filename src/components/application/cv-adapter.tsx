"use client";

import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { isLimitReached, type AiUsageCount } from "@/lib/ai-usage-limits";
import type { ProfileCv } from "@/lib/cv-types";

import { CvEditorLauncher } from "./editor-launchers";

/** « Adapter mon CV » : les deux boutons ouvrent le CV de la candidature dans le CV Builder. */
export function CvAdapter({
  applicationId,
  aiEnabled,
  profileCvs,
  hasImprovedCv,
  editorUsage,
  resetLabel,
}: {
  applicationId: string;
  aiEnabled: boolean;
  profileCvs: ProfileCv[];
  /** Un CV est déjà ouvert dans l'éditeur pour cette candidature. */
  hasImprovedCv: boolean;
  /** CV ouverts dans l'éditeur (première ouverture d'un CV du profil) ce mois-ci. */
  editorUsage: AiUsageCount;
  /** Date de remise à zéro du compteur (ex. « 1er novembre 2026 »). */
  resetLabel: string;
}) {
  const editorLauncher = {
    applicationId,
    profileCvs,
    hasCv: hasImprovedCv,
    aiEnabled,
    limitReached: isLimitReached(editorUsage),
    resetLabel,
  };

  return (
    <section aria-labelledby="cv-title" className="card p-5">
      <h2 id="cv-title" className="text-blue-600 dark:text-blue-400 font-semibold">
        Adapter mon CV
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CvEditorLauncher {...editorLauncher} className="btn-primary px-4 py-2 text-sm" />
        <OnboardingTip id="adapter-cv" text="Analyse ton CV pour ce poste">
          <CvEditorLauncher {...editorLauncher} label="Analyser mon CV" className="btn-secondary px-4 py-2 text-sm" />
        </OnboardingTip>
      </div>
    </section>
  );
}
