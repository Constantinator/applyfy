import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { NewApplicationForm } from "@/components/application/new-application-form";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";

export const metadata: Metadata = { title: "Nouvelle candidature — Applyfy" };

export default async function NewApplicationPage() {
  await connection(); // rendu à chaque requête (page réservée aux utilisateurs connectés)
  const usage = await readAiUsage();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Nouvelle candidature</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Ajoute une candidature pour suivre son avancement et être prévenu·e quand relancer.
      </p>
      <NewApplicationForm
        aiEnabled={isClaudeConfigured()}
        summaryUsage={usage.counts.resume_offre}
        resetLabel={formatResetDate(usage.resetsOn)}
      />
    </main>
  );
}
