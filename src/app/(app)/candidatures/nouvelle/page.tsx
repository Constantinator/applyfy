import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { NewApplicationForm } from "@/components/application/new-application-form";
import { ClearSearchParams } from "@/components/clear-search-params";
import { GuidedPageHeader } from "@/components/onboarding/guided-page-header";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";
import { parseOfferLink } from "@/lib/offer-limits";
import { getGuidedOfferStep } from "@/lib/onboarding-server";

export const metadata: Metadata = { title: "Nouvelle candidature — Applyfy" };

export default async function NewApplicationPage({
  searchParams,
}: PageProps<"/candidatures/nouvelle">) {
  await connection(); // rendu à chaque requête (page réservée aux utilisateurs connectés)
  const [usage, { lien, accueil }] = await Promise.all([
    readAiUsage(),
    searchParams,
  ]);
  const offerLink = parseOfferLink(lien);
  // Depuis l'écran de l'offre de la phase guidée (accueil=1, étape « guide_offre », compte récent) :
  // en-tête guidé, barre et bouton rond masqués, pied de page réduit, « Annuler » vers l'offre.
  const guided = await getGuidedOfferStep(accueil === "1");
  return (
    <div className="flex flex-1 flex-col bg-page dark:bg-slate-950">
      {guided && <GuidedPageHeader step="guide_offre" />}
      <main className="ui-page-narrow flex-1">
        {/* Lien retiré de l'adresse dès l'arrivée : recharger la page ne relance pas l'import.
            accueil=1 est gardé : un rechargement reste dans la phase guidée. */}
        {(lien !== undefined || accueil !== undefined) && (
          <ClearSearchParams keep={accueil === "1" ? "accueil=1" : ""} />
        )}
        {!guided && (
          <Link
            href="/candidatures"
            className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white"
          >
            Retour aux candidatures
          </Link>
        )}
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] mt-3 text-ink dark:text-white">
          Nouvelle candidature
        </h1>
        <p className="mt-2.5 mb-8 text-muted dark:text-slate-400">
          Ajoute une candidature sur ton dashboard
        </p>
        <NewApplicationForm
          initialOfferUrl={offerLink}
          invalidOfferLink={lien !== undefined && !offerLink}
          aiEnabled={isClaudeConfigured()}
          summaryUsage={usage.counts.resume_offre}
          resetLabel={formatResetDate(usage.resetsOn)}
          fromGuide={accueil === "1"}
          cancelHref={guided ? "/bienvenue" : "/candidatures"}
        />
      </main>
    </div>
  );
}
