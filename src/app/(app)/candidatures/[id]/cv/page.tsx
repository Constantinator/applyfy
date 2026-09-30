import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CvEditor } from "@/components/application/cv-editor";
import { getApplicationDetail } from "@/lib/applications";
import { sanitizeCvHtml } from "@/lib/cv-html";

export const metadata: Metadata = { title: "Mon CV amélioré — Applyfy" };

/** Premier <h1> du CV (le nom du candidat), pour nommer le fichier PDF. */
function candidateName(html: string) {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() : "";
}

export default async function ImprovedCvPage({ params }: PageProps<"/candidatures/[id]/cv">) {
  const { id } = await params;
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();
  const { application: app } = detail;

  return (
    <main
      className={`mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:space-y-0 print:p-0`}
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
          savedAt={app.cv_improved_at ?? null}
          pdfTitle={["CV", candidateName(app.cv_improved_html), "-", app.company]
            .filter(Boolean)
            .join(" ")}
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
