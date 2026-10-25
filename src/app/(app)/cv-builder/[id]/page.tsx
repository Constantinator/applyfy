import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CvBuilderEditor } from "@/components/cv-builder/cv-builder-editor";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getBuilderCv } from "@/lib/cv-builder";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

export default async function CvBuilderEditorPage({ params }: PageProps<"/cv-builder/[id]">) {
  await connection(); // CV et compteurs IA lus à chaque visite
  const { id } = await params;
  const [cv, usage] = await Promise.all([getBuilderCv(id), readAiUsage()]);
  if (!cv) notFound();

  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <CvBuilderEditor
        cv={cv}
        usage={{
          counts: { cvb_puce: usage.counts.cvb_puce, cvb_resume: usage.counts.cvb_resume, cvb_adaptation: usage.counts.cvb_adaptation },
          resetLabel: formatResetDate(usage.resetsOn),
        }}
      />
    </main>
  );
}
