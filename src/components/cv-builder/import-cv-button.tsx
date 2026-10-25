"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { importBuilderCvAction } from "@/app/actions/cv-builder";
import { UsageLimitBanner } from "@/components/usage/usage-limit-banner";
import { CV_IMPORT_FOLDER, CV_IMPORT_MAX_BYTES, CV_IMPORT_MAX_LABEL } from "@/lib/cv-builder-types";
import { createClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const TYPES: Record<string, { ext: "pdf" | "docx"; mime: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

/**
 * Le fichier est déposé dans le stockage privé de l'utilisateur puis lu par le serveur : un
 * CV de 5 Mo dépasse la taille maximale d'une requête vers le serveur (4,5 Mo sur Vercel).
 * Mode démo (sans Supabase) : envoyé avec la requête.
 */
async function sendForImport(file: File, ext: "pdf" | "docx") {
  const formData = new FormData();
  if (!SUPABASE_CONFIGURED) {
    formData.set("file", file);
    return importBuilderCvAction(formData);
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, error: "Ta session a expiré : reconnecte-toi." };
  const path = `${data.user.id}/${CV_IMPORT_FOLDER}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: TYPES[ext].mime });
  if (error) {
    console.error("[cv-builder] dépôt de l'import", error.message);
    return { ok: false as const, error: "Le fichier n'a pas pu être envoyé. Réessaie." };
  }
  formData.set("path", path);
  return importBuilderCvAction(formData);
}

/** « Importer un CV » : PDF ou Word lu par l'IA, puis l'éditeur avec les champs pré-remplis. */
export function ImportCvButton({ resetLabel }: { resetLabel: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // Fenêtre de chargement pendant l'extraction.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  async function onFile(file: File) {
    setError(null);
    setLimitReached(false);
    const ext = file.name.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
    if (!ext) return setError("Choisis un fichier PDF ou Word (.docx).");
    if (file.size > CV_IMPORT_MAX_BYTES) return setError(`Ton CV dépasse ${CV_IMPORT_MAX_LABEL}.`);

    setPending(true);
    try {
      const result = await sendForImport(file, ext as "pdf" | "docx");
      if (result.ok) {
        router.push(`/cv-builder/${result.id}`);
        return; // le chargement reste affiché jusqu'à l'ouverture de l'éditeur
      }
      if ("limitReached" in result && result.limitReached) setLimitReached(true);
      else setError(result.error);
    } catch (e) {
      console.error("[cv-builder] import", e);
      setError("L'import a échoué. Réessaie dans un instant.");
    }
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="btn-secondary px-5 py-2.5 text-sm"
      >
        Importer un CV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      {error && (
        <p role="alert" className="max-w-sm text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {limitReached && (
        <div className="max-w-md">
          <UsageLimitBanner resetLabel={resetLabel} />
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="import-cv-title"
        // Pas de fermeture pendant l'extraction (Échap).
        onCancel={(e) => e.preventDefault()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/50 dark:bg-slate-900"
      >
        <div role="status" className="flex flex-col items-center gap-4 p-8 text-center">
          <span
            aria-hidden="true"
            className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 motion-reduce:animate-none dark:border-blue-500/20 dark:border-t-blue-400"
          />
          <div>
            <h2 id="import-cv-title" className="font-semibold text-slate-900 dark:text-white">
              Lecture de ton CV…
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              L&apos;IA remplit le formulaire avec tes informations. Cela peut prendre jusqu&apos;à une minute.
            </p>
          </div>
        </div>
      </dialog>
    </div>
  );
}
