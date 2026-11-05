"use client";

import { OnboardingTip } from "@/components/onboarding/onboarding-tip";
import { isLimitReached, type AiUsageCount } from "@/lib/ai-usage-limits";
import type { BuilderCvChoice } from "@/lib/cv-builder-types";
import type { ProfileCv } from "@/lib/cv-types";

import { CvEditorLauncher } from "./editor-launchers";

/** Bouton de la fiche : ouvre le CV de la candidature dans le CV Builder. */
export function CvAdapter({
  applicationId,
  aiEnabled,
  profileCvs,
  builderCvs,
  linkedCvId,
  hasLegacyCv,
  editorUsage,
  resetLabel,
}: {
  applicationId: string;
  aiEnabled: boolean;
  profileCvs: ProfileCv[];
  /** CV du CV Builder de l'utilisateur, proposés à la reprise. */
  builderCvs: BuilderCvChoice[];
  /** CV du CV Builder lié à cette candidature. */
  linkedCvId: string | null;
  /** CV de l'ancien éditeur, ouvert pour cette candidature. */
  hasLegacyCv: boolean;
  /** CV ouverts dans l'éditeur ce mois-ci : limite de l'import d'un PDF. */
  editorUsage: AiUsageCount;
  /** Date de remise à zéro du compteur (ex. « 1er novembre 2026 »). */
  resetLabel: string;
}) {
  return (
    <section aria-labelledby="cv-title" className="card p-5">
      <h2 id="cv-title" className="text-blue-600 dark:text-blue-400 font-semibold">
        CV
      </h2>
      <div className="mt-4">
        <OnboardingTip id="adapter-cv" text="Adapte ton CV à cette offre">
          <CvEditorLauncher
            applicationId={applicationId}
            profileCvs={profileCvs}
            builderCvs={builderCvs}
            linkedCvId={linkedCvId}
            hasLegacyCv={hasLegacyCv}
            aiEnabled={aiEnabled}
            limitReached={isLimitReached(editorUsage)}
            resetLabel={resetLabel}
            className="btn-primary px-4 py-2 text-sm"
          />
        </OnboardingTip>
      </div>
    </section>
  );
}
