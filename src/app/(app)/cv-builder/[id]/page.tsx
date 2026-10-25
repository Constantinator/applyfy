import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { CvBuilderEditor } from "@/components/cv-builder/cv-builder-editor";
import { ImportedCvWorkspace } from "@/components/cv-builder/imported-cv-workspace";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getBuilderCv } from "@/lib/cv-builder";
import { cvFontVariables } from "@/lib/cv-fonts";
import { sanitizeCvHtml } from "@/lib/cv-html";

export const metadata: Metadata = { title: "CV Builder — Applyfy" };

// « Convertir en template Applyfy » peut relire le CV avec l'IA (quelques dizaines de secondes).
export const maxDuration = 120;

export default async function CvBuilderEditorPage({ params }: PageProps<"/cv-builder/[id]">) {
  await connection(); // CV et compteurs IA lus à chaque visite
  const { id } = await params;
  const [cv, usage] = await Promise.all([getBuilderCv(id), readAiUsage()]);
  if (!cv) notFound();

  // CV importé, pas encore converti : éditeur de CV (HTML), comme sur une candidature.
  if (cv.imported) {
    return (
      // data-theme-off : l'éditeur reste en clair même en mode sombre (feuille blanche).
      <main
        data-theme-off
        className={`${cvFontVariables} mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0`}
      >
        <ImportedCvWorkspace
          // Renettoyé à l'affichage (défense en profondeur, en plus du nettoyage à l'enregistrement).
          cv={{ ...cv, imported: { ...cv.imported, html: sanitizeCvHtml(cv.imported.html) } }}
          pdfTitle={cv.title}
        />
      </main>
    );
  }

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
