import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getAccountName } from "@/lib/account";
import { AI_MONTHLY_LIMITS } from "@/lib/ai-usage-limits";
import { requireUser } from "@/lib/auth";
import { CV_IMPORT_MAX_LABEL } from "@/lib/cv-builder-types";
import { ONBOARDING_TEXTS } from "@/lib/lumeo-texts";
import { getOnboardingEntry } from "@/lib/onboarding-server";
import { isPremium } from "@/lib/subscription";

export const metadata: Metadata = { title: `${ONBOARDING_TEXTS.pageTitle} — Applyfy`, robots: { index: false } };

/**
 * Parcours d'accueil (comptes créés après sa mise en ligne). Rien à proposer (parcours terminé,
 * compte plus ancien, table absente) : retour au tableau de bord, qui ne renvoie pas ici.
 */
export default async function WelcomePage() {
  await connection();
  await requireUser();
  const entry = await getOnboardingEntry();
  if (!entry) redirect("/dashboard");

  const [accountName, premium] = await Promise.all([
    getAccountName().catch(() => null),
    // Sans échec côté isPremium ; au pire, la note d'import s'affiche.
    isPremium().catch(() => false),
  ]);

  return (
    <OnboardingFlow
      firstName={accountName?.firstName ?? null}
      initial={{ ...entry.state, step: entry.screen }}
      importNote={premium ? null : ONBOARDING_TEXTS.cv.importNote(AI_MONTHLY_LIMITS.cvb_import)}
      importMaxLabel={CV_IMPORT_MAX_LABEL}
    />
  );
}
