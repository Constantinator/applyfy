import type { Metadata } from "next";

import { IconPuzzle } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Extension Chrome — Applyfy" };

const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/applyfy-%E2%80%94-import-doffres/cbjahcpjmbgmpepjjdllejmfomcjgbne";

const STEPS = [
  {
    title: "Copie-colle un lien d'offre",
    text: "Depuis LinkedIn, JobTeaser, Indeed, Welcome to the Jungle ou la page carrière d'une entreprise.",
  },
  {
    title: "Le formulaire se remplit tout seul",
    text: "Entreprise, poste, lieu et description de l'offre sont repris dans « Ajouter une candidature ».",
  },
  {
    title: "Gagne du temps à chaque candidature",
    text: "Plus besoin de recopier l'annonce : vérifie, ajuste si besoin et enregistre.",
  },
];

/** Présentation de l'extension Chrome d'import d'offres, avec le lien vers le Chrome Web Store. */
export default async function ExtensionPage() {
  if (isSupabaseConfigured()) await requireUser();

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
      <main className="ui-page-narrow flex-1 space-y-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:text-slate-200">
            <IconPuzzle className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">
              Extension Chrome
            </h1>
            <p className="mt-1.5 text-muted dark:text-slate-400">
              Ajoute une offre à Applyfy en collant simplement son lien, sans rien recopier.
            </p>
          </div>
        </div>

        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="ui-card space-y-3 p-5 sm:p-7"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h2 className="ui-title-sm">{step.title}</h2>
              <p className="text-sm text-muted dark:text-slate-300">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="ui-card flex flex-col items-center gap-3 p-5 sm:p-7 text-center">
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-primary inline-flex text-base"
          >
            Installer l&apos;extension
          </a>
          <p className="text-sm text-muted dark:text-slate-400">
            Gratuite, depuis le Chrome Web Store.
          </p>
        </div>
      </main>
    </div>
  );
}
