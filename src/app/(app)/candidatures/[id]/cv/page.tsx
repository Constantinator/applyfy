import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CvEditor } from "@/components/application/cv-editor";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getApplicationDetail } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { cvFontVariables } from "@/lib/cv-fonts";
import { firstHeadingText, sanitizeCvHtml } from "@/lib/cv-html";
import { readCvStyle } from "@/lib/cv-style";

export const metadata: Metadata = { title: "Mon CV amélioré — Applyfy" };

// « Affiner avec l'IA » (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;


export default async function ImprovedCvPage({ params }: PageProps<"/candidatures/[id]/cv">) {
  const { id } = await params;
  const [detail, usage] = await Promise.all([getApplicationDetail(id), readAiUsage()]);
  if (!detail) notFound();
  const { application: app } = detail;

  return (
    <main
      className={`${cvFontVariables} mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:space-y-0 print:p-0`}
    >
      <div className="space-y-1 print:hidden">
        <Link
          href={`/candidatures/${app.id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Retour à la candidature {app.company}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Mon CV amélioré</h1>
        <p className="text-sm text-slate-500">
          Adapté au poste « {app.position} » chez {app.company}.
        </p>
      </div>

      {app.cv_improved_html ? (
        // Renettoyé à l'affichage (défense en profondeur, en plus du nettoyage à l'enregistrement).
        <CvEditor
          applicationId={app.id}
          initialHtml={sanitizeCvHtml(app.cv_improved_html)}
          initialStyle={readCvStyle(app.cv_improved_style)}
          savedAt={app.cv_improved_at ?? null}
          pdfTitle={["CV", firstHeadingText(app.cv_improved_html), "-", app.company]
            .filter(Boolean)
            .join(" ")}
          refine={{
            aiEnabled: isClaudeConfigured(),
            usage: usage.counts.affinage_cv,
            resetLabel: formatResetDate(usage.resetsOn),
          }}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center print:hidden">
          <p className="font-medium text-slate-900">Pas encore de CV amélioré pour cette candidature</p>
          <p className="mt-1 text-sm text-slate-500">
            Lance « Adapter mon CV » sur la fiche, puis « Générer mon CV amélioré ».
          </p>
          <Link
            href={`/candidatures/${app.id}`}
            className="btn-primary mt-4 px-4 py-2 text-sm"
          >
            Aller à la fiche
          </Link>
        </div>
      )}
    </main>
  );
}
