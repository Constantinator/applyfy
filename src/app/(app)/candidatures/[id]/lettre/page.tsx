import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CvEditor } from "@/components/application/cv-editor";
import { getAccountName } from "@/lib/account";
import { readAiUsage } from "@/lib/ai-usage";
import { formatResetDate } from "@/lib/ai-usage-limits";
import { getApplicationDetail } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";
import { emptyCoverLetterHtml } from "@/lib/cover-letter";
import { cvFontVariables } from "@/lib/cv-fonts";
import { firstHeadingText, sanitizeCvHtml } from "@/lib/cv-html";
import { DEFAULT_LETTER_STYLE, readCvStyle } from "@/lib/cv-style";
import { fullName } from "@/lib/person-name";

export const metadata: Metadata = { title: "Ma lettre de motivation — Applyfy" };

// « Affiner avec l'IA » (Server Action de cette page) : jusqu'à une minute.
export const maxDuration = 120;

export default async function CoverLetterPage({ params }: PageProps<"/candidatures/[id]/lettre">) {
  const { id } = await params;
  const [detail, usage, accountName] = await Promise.all([
    getApplicationDetail(id),
    readAiUsage(),
    // Non bloquant : sans nom, le modèle vierge affiche « Prénom Nom ».
    getAccountName().catch(() => null),
  ]);
  if (!detail) notFound();
  const { application: app } = detail;

  return (
    <main
      className={`${cvFontVariables} mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:space-y-0 print:p-0`}
    >
      <div className="space-y-1 print:hidden">
        <Link href={`/candidatures/${app.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Retour à la candidature {app.company}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ma lettre de motivation</h1>
        <p className="text-sm text-slate-500">
          Pour le poste « {app.position} » chez {app.company}.
        </p>
      </div>

      {/* Renettoyée à l'affichage (défense en profondeur, en plus du nettoyage à
          l'enregistrement). Sans lettre enregistrée : modèle vierge, enregistré au premier
          « Enregistrer ». */}
      <CvEditor
        kind="lettre"
        applicationId={app.id}
        initialHtml={sanitizeCvHtml(
          app.cover_letter_html ??
            emptyCoverLetterHtml(app.position, app.company, accountName ? fullName(accountName) : null),
        )}
        initialStyle={readCvStyle(app.cover_letter_style, DEFAULT_LETTER_STYLE)}
        savedAt={app.cover_letter_html ? (app.cover_letter_at ?? null) : null}
        pdfTitle={["Lettre de motivation", firstHeadingText(app.cover_letter_html ?? ""), "-", app.company]
          .filter(Boolean)
          .join(" ")}
        refine={{
          aiEnabled: isClaudeConfigured(),
          usage: usage.counts.affinage_lettre,
          resetLabel: formatResetDate(usage.resetsOn),
        }}
      />
    </main>
  );
}
