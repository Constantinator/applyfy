import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CvBuilderEditor } from "@/components/cv-builder/cv-builder-editor";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { isClaudeConfigured } from "@/lib/claude";
import { getBuilderCv } from "@/lib/cv-builder";
import { loadScoringContext } from "@/lib/cv-score-context";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

// Chat « Affiner avec l'IA » (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;

export default async function CvBuilderEditorPage({ params }: PageProps<"/cv-builder/[id]">) {
  await connection(); // CV et compteurs IA lus à chaque visite
  const { id } = await params;
  const [cv, usage] = await Promise.all([getBuilderCv(id), readAiUsage()]);
  if (!cv) notFound();
  const scoring = await loadScoringContext(cv.data);

  return (
    // Éditeur en plein écran (sans barre latérale ni en-tête de l'application, cf. app-nav-context).
    <main className="w-full flex-1">
      <CvBuilderEditor
        cv={cv}
        scoring={scoring}
        usage={{
          chat: usage.counts.cvb_chat,
          resetLabel: formatResetDate(usage.resetsOn),
          aiEnabled: isClaudeConfigured(),
        }}
      />
    </main>
  );
}
