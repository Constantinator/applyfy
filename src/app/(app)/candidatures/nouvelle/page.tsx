import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { NewApplicationForm } from "@/components/application/new-application-form";
import { ClearSearchParams } from "@/components/clear-search-params";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";
import { parseOfferLink } from "@/lib/offer-limits";

export const metadata: Metadata = { title: "Nouvelle candidature — Applyfy" };

export default async function NewApplicationPage({ searchParams }: PageProps<"/candidatures/nouvelle">) {
  await connection(); // rendu à chaque requête (page réservée aux utilisateurs connectés)
  const [usage, { lien }] = await Promise.all([readAiUsage(), searchParams]);
  const offerLink = parseOfferLink(lien);
  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page-narrow flex-1">
        {/* Retiré de l'adresse dès l'arrivée : recharger la page ne relance pas l'import. */}
        {lien !== undefined && <ClearSearchParams />}
        <Link href="/candidatures" className="ui-focus -my-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink dark:text-slate-400 dark:hover:text-white">
          Retour aux candidatures
        </Link>
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] mt-3 text-ink dark:text-white">Nouvelle candidature</h1>
        <p className="mt-2.5 mb-8 text-muted dark:text-slate-400">
          Ajoute une candidature sur ton dashboard
        </p>
        <NewApplicationForm
          initialOfferUrl={offerLink}
          invalidOfferLink={lien !== undefined && !offerLink}
          aiEnabled={isClaudeConfigured()}
          summaryUsage={usage.counts.resume_offre}
          resetLabel={formatResetDate(usage.resetsOn)}
        />
      </main>
    </div>
  );
}
