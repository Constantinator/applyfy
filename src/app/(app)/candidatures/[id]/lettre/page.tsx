import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CvEditor } from "@/components/application/cv-editor";
import { ClearSearchParams } from "@/components/clear-search-params";
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

/** Demande envoyée au chat avec « S'aider du CV en cours ». */
const WRITE_FROM_CV_PROMPT = "Rédige ma lettre de motivation pour cette offre à partir de mon CV.";

export default async function CoverLetterPage({ params, searchParams }: PageProps<"/candidatures/[id]/lettre">) {
  const { id } = await params;
  // Point de départ choisi sur la fiche : modèle vierge (« vierge »), ou modèle vierge
  // rédigé aussitôt par le chat à partir du CV (« cv ») ; sinon, la lettre enregistrée.
  const { depart } = await searchParams;
  const fresh = depart === "vierge" || depart === "cv";
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

      {fresh && <ClearSearchParams />}
      {fresh && app.cover_letter_html && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 print:hidden">
          Nouvelle lettre : ta lettre enregistrée ne sera remplacée que si tu cliques sur « Enregistrer ».
          La sauvegarde automatique démarre ensuite.
        </p>
      )}

      {/* Renettoyée à l'affichage (défense en profondeur, en plus du nettoyage à
          l'enregistrement). Modèle vierge (nouvelle lettre ou aucune lettre enregistrée) :
          enregistré au premier « Enregistrer ». */}
      <CvEditor
        key={fresh ? String(depart) : "lettre"}
        autosaveAfterManualSave={fresh && Boolean(app.cover_letter_html)}
        kind="lettre"
        applicationId={app.id}
        initialHtml={sanitizeCvHtml(
          (!fresh && app.cover_letter_html) ||
            emptyCoverLetterHtml(app.position, app.company, accountName ? fullName(accountName) : null),
        )}
        initialStyle={readCvStyle(app.cover_letter_style, DEFAULT_LETTER_STYLE)}
        savedAt={!fresh && app.cover_letter_html ? (app.cover_letter_at ?? null) : null}
        pdfTitle={["Lettre de motivation", firstHeadingText(app.cover_letter_html ?? ""), "-", app.company]
          .filter(Boolean)
          .join(" ")}
        refine={{
          aiEnabled: isClaudeConfigured(),
          usage: usage.counts.affinage_lettre,
          resetLabel: formatResetDate(usage.resetsOn),
          initialPrompt: depart === "cv" ? WRITE_FROM_CV_PROMPT : undefined,
        }}
      />
    </main>
  );
}
