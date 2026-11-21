"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { finishGuideAction } from "@/app/actions/onboarding";
import { GuidedHeader } from "@/components/cv-builder/guided-header";
import type { GuideEditorStep } from "@/lib/onboarding";

/**
 * Phase guidée sur les pages d'import et de création (barre normale de l'application) : la barre
 * et le bouton rond de Lumeo (repérés par data-app-chrome) sont masqués par une règle de style
 * rendue avec la page (aucun affichage furtif, rien ne reste après l'avoir quittée), et l'en-tête
 * guidé les remplace. « Passer » : seule sortie, toujours active.
 */
export function GuidedPageHeader({ step }: { step: GuideEditorStep }) {
  const router = useRouter();
  const leaving = useRef(false);

  function skip() {
    if (leaving.current) return;
    leaving.current = true;
    // Quoi qu'il arrive à l'enregistrement, la personne part (pas de blocage, pas de boucle).
    void finishGuideAction(step)
      .catch(() => undefined)
      .then(() => router.push("/dashboard"));
  }

  return (
    <>
      <style>{"[data-app-chrome]{display:none!important}"}</style>
      <GuidedHeader step={step} onSkip={skip} />
    </>
  );
}
