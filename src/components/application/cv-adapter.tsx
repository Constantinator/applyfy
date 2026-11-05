import Link from "next/link";

import { OnboardingTip } from "@/components/onboarding/onboarding-tip";

/** Carte « CV » de la fiche : mène à la création du CV de cette candidature dans le CV Builder. */
export function CvAdapter({ applicationId }: { applicationId: string }) {
  return (
    <section aria-labelledby="cv-title" className="card p-5">
      <h2 id="cv-title" className="text-blue-600 dark:text-blue-400 font-semibold">
        CV
      </h2>
      <div className="mt-4">
        <OnboardingTip id="adapter-cv" text="Adapte ton CV à cette offre">
          <Link href={`/cv-builder?applicationId=${applicationId}`} className="btn-primary px-4 py-2 text-sm">
            Adapter mon CV à l&apos;offre
          </Link>
        </OnboardingTip>
      </div>
    </section>
  );
}
