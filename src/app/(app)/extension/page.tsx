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
      <main className="ui-page flex-1">
        <div className="max-w-[820px]">
          <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.035em] text-ink dark:text-white">
            Extension Chrome
          </h1>
          <p className="mt-2.5 text-base text-muted dark:text-slate-400">
            Ajoute une offre à Applyfy en collant simplement son lien, sans rien recopier.
          </p>

          <div className="ui-card mt-7 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-[18px] sm:p-7">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-box text-ink dark:bg-slate-800 dark:text-slate-200">
              <IconPuzzle className="h-6 w-6" />
            </span>
            <p className="flex-1 text-sm text-muted dark:text-slate-400">Gratuite, depuis le Chrome Web Store.</p>
            <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className="ui-btn-primary">
              Installer l&apos;extension
            </a>
          </div>

          <ol className="ui-card mt-5 px-5 py-2 sm:px-7">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex items-center gap-3.5 border-t border-line-soft py-4 first:border-t-0 dark:border-slate-800"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-box font-bold text-ink dark:bg-slate-800 dark:text-slate-200">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-ink dark:text-white">{step.title}</h2>
                  <p className="mt-0.5 text-sm text-muted dark:text-slate-300">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}
