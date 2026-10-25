"use client";

import { usePDF } from "@react-pdf/renderer";
import { useEffect, useState } from "react";

import type { CvData, CvTemplateId } from "@/lib/cv-builder-types";

import { CvDocument } from "./cv-document";

/**
 * Prévisualisation en temps réel : le PDF lui-même, regénéré peu après chaque
 * modification et affiché par le lecteur PDF du navigateur.
 */
export default function CvPreview({ data, templateId, title }: { data: CvData; templateId: CvTemplateId; title: string }) {
  const [instance, update] = usePDF();
  // PDF affiché, et PDF suivant chargé en dessous : il ne remplace l'affiché qu'une fois
  // chargé (pas d'écran vide du lecteur PDF à chaque modification).
  const [shown, setShown] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => update(<CvDocument data={data} templateId={templateId} title={title} />), 400);
    return () => clearTimeout(timer);
  }, [data, templateId, title, update]);

  const ready = !instance.loading ? instance.url : null;
  if (ready && ready !== shown && ready !== next) setNext(ready);

  if (instance.error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-700 dark:text-red-300">
        La prévisualisation n&apos;a pas pu être générée. Vérifie la photo, ou recharge la page.
      </p>
    );
  }
  if (!shown && !next) {
    return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Préparation de l&apos;aperçu…</p>;
  }
  // Même clé pour un PDF qui passe de « suivant » à « affiché » : l'iframe n'est pas rechargée.
  return (
    <div className="relative h-full w-full">
      {[shown, next].map((url) =>
        url ? (
          <iframe
            key={url}
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title="Aperçu du CV"
            aria-hidden={url === next || undefined}
            tabIndex={url === next ? -1 : undefined}
            onLoad={
              url === next
                ? // Le lecteur PDF peint la page peu après l'événement load.
                  () =>
                    setTimeout(() => {
                      setShown(url);
                      setNext((current) => (current === url ? null : current));
                    }, 150)
                : undefined
            }
            className={`absolute inset-0 h-full w-full rounded-xl border-0 bg-white ${url === next ? "opacity-0" : ""}`}
          />
        ) : null,
      )}
    </div>
  );
}
