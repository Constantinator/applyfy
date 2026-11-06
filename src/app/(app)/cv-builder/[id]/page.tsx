import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CvBuilderEditor } from "@/components/cv-builder/cv-builder-editor";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getApplicationDetail } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { getBuilderCv } from "@/lib/cv-builder";
import { loadScoringContext } from "@/lib/cv-score-context";
import { readCvSuggestions } from "@/lib/cv-types";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

// Chat « Affiner avec l'IA » (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;

export default async function CvBuilderEditorPage({ params }: PageProps<"/cv-builder/[id]">) {
  await connection(); // CV et compteurs IA lus à chaque visite
  const { id } = await params;
  const [cv, usage] = await Promise.all([getBuilderCv(id), readAiUsage()]);
  if (!cv) notFound();
  const [scoring, detail] = await Promise.all([
    loadScoringContext(cv.data),
    // CV ouvert depuis une fiche : mots-clés de l'analyse faite pour cette candidature.
    cv.applicationId ? getApplicationDetail(cv.applicationId) : null,
  ]);
  const analysis = readCvSuggestions(detail?.application.cv_suggestions);

  return (
    // Éditeur en plein écran (sans barre de navigation de l'application, cf. app-nav-context).
    <main className="w-full flex-1">
      <CvBuilderEditor
        cv={cv}
        scoring={scoring}
        application={
          detail && {
            id: detail.application.id,
            keywords: analysis?.kind === "keywords" ? { keywords: analysis.keywords, ignored: analysis.ignored } : null,
            missingPoints: analysis?.kind === "legacy" ? analysis.ce_qui_manque : [],
          }
        }
        usage={{
          chat: usage.counts.cvb_chat,
          resetLabel: formatResetDate(usage.resetsOn),
          aiEnabled: isClaudeConfigured(),
        }}
      />
    </main>
  );
}
