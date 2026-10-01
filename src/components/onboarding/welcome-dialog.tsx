"use client";

import { useEffect, useRef, useState } from "react";

import { completeOnboardingAction } from "@/app/actions/onboarding";
import { IconBell, IconDocument, IconPlus } from "@/components/icons";
import { ONBOARDING_OPEN_ATTRIBUTE, notifyOnboardingChange } from "@/lib/onboarding-tips";

const STEPS = [
  { icon: IconDocument, title: "Uploade ton CV dans Mon profil", detail: "Il servira à adapter ton CV et rédiger tes lettres." },
  { icon: IconPlus, title: "Ajoute ta première candidature", detail: "Colle le lien de l'offre : on pré-remplit le reste." },
  { icon: IconBell, title: "Active tes rappels de relance", detail: "Un email quand il est temps de relancer, dans Mon profil." },
];

/** Écran de bienvenue, affiché tant que l'utilisateur ne l'a pas fermé (première connexion). */
export function WelcomeDialog({ firstName }: { firstName: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);

  // Fenêtre modale native : focus piégé, Échap, arrière-plan inerte.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  // Fermée : les bulles d'aide peuvent apparaître.
  useEffect(() => {
    if (!open) notifyOnboardingChange();
  }, [open]);

  function finish() {
    dialogRef.current?.close();
    setOpen(false);
    // Fermeture immédiate ; l'enregistrement se fait en arrière-plan.
    void completeOnboardingAction();
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      {...{ [ONBOARDING_OPEN_ATTRIBUTE]: "" }}
      aria-labelledby="welcome-title"
      // Échap : même effet que « C'est parti ! ».
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-0 shadow-2xl shadow-slate-900/20 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="bg-brand-gradient px-6 pt-7 pb-6 text-white sm:px-8">
        <p className="text-sm font-medium text-white/80">Ton espace est prêt</p>
        <h2 id="welcome-title" className="mt-1 text-2xl font-bold tracking-tight">
          Bienvenue sur Applyfy{firstName ? `, ${firstName}` : ""} !
        </h2>
        <p className="mt-2 text-sm text-white/90">Trois étapes pour bien démarrer ta recherche :</p>
      </div>

      <ol className="space-y-4 px-6 py-6 sm:px-8">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <step.icon className="h-5 w-5" />
              <span className="bg-brand-gradient absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white">
                {index + 1}
              </span>
            </span>
            <span>
              <span className="block font-semibold text-slate-900">{step.title}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <button type="button" autoFocus onClick={finish} className="btn-primary w-full px-5 py-3 text-base">
          C&apos;est parti !
        </button>
      </div>
    </dialog>
  );
}
