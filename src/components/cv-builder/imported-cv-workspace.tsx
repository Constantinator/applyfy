"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { convertImportedCvAction, importReadinessAction, renameBuilderCvAction } from "@/app/actions/cv-builder";
import { CvEditor } from "@/components/application/cv-editor";
import type { BuilderCv } from "@/lib/cv-builder-types";
import { CV_LIMITS } from "@/lib/cv-builder-types";

import { TemplateChoiceDialog } from "./new-cv-dialog";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Attente maximale de l'extraction en arrière-plan avant d'ouvrir le choix du modèle. */
const MAX_WAIT_MS = 90_000;

/**
 * CV créé à partir d'un CV existant : HTML retranscrit, modifiable directement dans
 * l'éditeur de CV (comme sur une candidature), export PDF par l'impression. « Convertir en
 * template Applyfy » utilise les données extraites en arrière-plan.
 */
export function ImportedCvWorkspace({ cv, pdfTitle }: { cv: BuilderCv & { imported: NonNullable<BuilderCv["imported"]> }; pdfTitle: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(cv.title);
  const [waiting, setWaiting] = useState(false);
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConversion() {
    setError(null);
    setWaiting(true);
    // L'extraction a démarré avec l'import : le plus souvent déjà terminée.
    const start = Date.now();
    let readiness = await importReadinessAction(cv.id);
    while (readiness === "pending" && Date.now() - start < MAX_WAIT_MS) {
      await wait(1500);
      readiness = await importReadinessAction(cv.id);
    }
    setWaiting(false);
    if (readiness === "missing") {
      router.refresh(); // déjà converti (autre onglet)
      return;
    }
    setOpen(true);
    dialogRef.current?.showModal();
  }

  async function convert(templateId: Parameters<typeof convertImportedCvAction>[1]) {
    setConverting(true);
    setError(null);
    const result = await convertImportedCvAction(cv.id, templateId);
    if (result.ok) {
      dialogRef.current?.close();
      router.refresh(); // la page passe à l'éditeur des modèles
      return;
    }
    setConverting(false);
    setError(result.error);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href="/cv-builder" className="text-sm text-slate-500 hover:text-slate-900">
          Mes CV
        </Link>
        <input
          aria-label="Nom du CV"
          value={title}
          maxLength={CV_LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() !== cv.title) void renameBuilderCvAction(cv.id, title);
          }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none sm:text-2xl"
        />
        <button type="button" onClick={openConversion} disabled={waiting || converting} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          {waiting && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
            />
          )}
          {waiting ? "Préparation de la conversion…" : "Convertir en template Applyfy"}
        </button>
      </div>
      <p className="text-sm text-slate-500 print:hidden">
        Ton CV importé, modifiable directement. « Convertir en template Applyfy » le met en forme dans l&apos;un des 5 modèles
        du CV Builder, avec tes informations déjà remplies.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 print:hidden">
          {error}
        </p>
      )}

      <CvEditor
        kind="cvBuilder"
        applicationId={cv.id}
        initialHtml={cv.imported.html}
        initialStyle={cv.imported.style}
        savedAt={cv.updatedAt}
        pdfTitle={pdfTitle}
      />

      <TemplateChoiceDialog
        dialogRef={dialogRef}
        open={open}
        onClose={() => setOpen(false)}
        subtitle="Ton CV y sera repris automatiquement. Tu pourras changer de modèle ensuite."
        footer={(selected) => (
          <>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={converting}
              className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            >
              Annuler
            </button>
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              {error && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              )}
              <button type="button" onClick={() => convert(selected)} disabled={converting} className="btn-primary px-6 py-2.5 text-sm">
                {converting ? "Conversion…" : "Continuer"}
              </button>
            </div>
          </>
        )}
      />
    </div>
  );
}
