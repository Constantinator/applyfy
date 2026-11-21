import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { GuideOfferPickList } from "@/components/onboarding/guide-offer-picks";
import { GuideOfferScreen, OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getAccountName } from "@/lib/account";
import { AI_MONTHLY_LIMITS } from "@/lib/ai-usage-limits";
import { requireUser } from "@/lib/auth";
import { CV_IMPORT_MAX_LABEL } from "@/lib/cv-builder-types";
import { loadBravoTone } from "@/lib/guide-bravo";
import { loadGuideOfferPicks } from "@/lib/guide-offer-picks";
import { ONBOARDING_TEXTS } from "@/lib/lumeo-texts";
import { getOnboardingEntry } from "@/lib/onboarding-server";
import { isPremium } from "@/lib/subscription";

export const metadata: Metadata = { title: `${ONBOARDING_TEXTS.pageTitle} — Applyfy`, robots: { index: false } };

/**
 * Parcours d'accueil (comptes créés après sa mise en ligne). Rien à proposer (parcours terminé,
 * compte plus ancien, table absente) : retour au tableau de bord, qui ne renvoie pas ici.
 */
export default async function WelcomePage({ searchParams }: PageProps<"/bienvenue">) {
  await connection();
  await requireUser();
  const entry = await getOnboardingEntry();
  if (!entry) redirect("/dashboard");
  // Phase guidée en cours, CV déjà créé : on reprend dans l'éditeur.
  if (entry.target.kind === "editeur") redirect(`/cv-builder/${entry.target.cvId}`);
  // Phase guidée, CV enregistré : « Bravo » juste après l'enregistrement (?etape=bravo), puis
  // « Quelle offre t'intéresse ? ». Reprise plus tard : directement l'écran de l'offre.
  if (entry.target.kind === "offre") {
    const { etape } = await searchParams;
    const bravo = etape === "bravo";
    // Ton de « Bravo » d'après le score du CV (recalculé ici, seulement à l'arrivée sur « Bravo »).
    return (
      <GuideOfferScreen
        bravo={bravo}
        tone={bravo ? await loadBravoTone() : "debut"}
        // Offres proposées : en streaming, l'écran ne les attend jamais ; rien si elles manquent.
        picks={
          <Suspense fallback={null}>
            <GuideOfferPicks />
          </Suspense>
        }
      />
    );
  }

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

/** 3 offres d'après le métier du CV (lib/guide-offer-picks) ; liste vide : rien n'est affiché. */
async function GuideOfferPicks() {
  const picks = await loadGuideOfferPicks();
  return picks.length > 0 ? <GuideOfferPickList picks={picks} /> : null;
}
