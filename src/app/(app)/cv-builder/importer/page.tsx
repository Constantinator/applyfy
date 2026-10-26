import type { Metadata } from "next";
import { connection } from "next/server";

import { CvImportFlow } from "@/components/cv-builder/cv-import-flow";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";

export const metadata: Metadata = { title: "Créer un CV à partir d'un CV existant — Applyfy" };

// Lecture et analyse du CV par Claude (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;

/** « Créer un CV à partir d'un CV existant » : import, analyse, modèle, puis l'éditeur. */
export default async function CvImportPage() {
  await connection(); // compteurs IA lus à chaque visite
  const usage = await readAiUsage();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <CvImportFlow resetLabel={formatResetDate(usage.resetsOn)} aiEnabled={isClaudeConfigured()} />
    </main>
  );
}
