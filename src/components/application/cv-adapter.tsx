import Link from "next/link";

import { OnboardingTip } from "@/components/onboarding/onboarding-tip";

/** Carte « CV » de la fiche : mène à la page du CV Builder consacrée à cette candidature. */
export function CvAdapter({ applicationId, hasLinkedCv }: { applicationId: string; hasLinkedCv: boolean }) {
  return (
    <section aria-labelledby="cv-title" className="ui-card p-5 sm:p-7">
      <h2 id="cv-title" className="ui-title-sm">
        CV
      </h2>
      <div className="mt-4">
        <OnboardingTip id="adapter-cv" text="Adapte ton CV à cette offre">
          <Link href={`/cv-builder?applicationId=${applicationId}`} className={hasLinkedCv ? "ui-btn-secondary" : "ui-btn-primary"}>
            {hasLinkedCv ? "Modifier mon CV pour cette offre" : "Adapter mon CV à l'offre"}
          </Link>
        </OnboardingTip>
      </div>
    </section>
  );
}
