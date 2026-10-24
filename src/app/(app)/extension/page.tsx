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
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/20">
          <IconPuzzle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Extension Chrome
          </h1>
          <p className="mt-1.5 text-slate-500 dark:text-slate-400">
            Ajoute une offre à Applyfy en collant simplement son lien, sans rien recopier.
          </p>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card space-y-3 p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <h2 className="font-semibold text-slate-900 dark:text-white">{step.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="card flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex px-8 py-3.5 text-base"
        >
          Installer l&apos;extension
        </a>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gratuite, depuis le Chrome Web Store.
        </p>
      </div>
    </main>
  );
}
