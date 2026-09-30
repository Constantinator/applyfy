import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { NewApplicationForm } from "@/components/application/new-application-form";
import { today } from "@/lib/applications";
import { isClaudeConfigured } from "@/lib/claude";

export const metadata: Metadata = { title: "Nouvelle candidature — Applyfy" };

export default async function NewApplicationPage() {
  await connection(); // rendu à chaque requête : la date par défaut doit être celle du jour
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Retour au dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Nouvelle candidature</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Ajoute une candidature pour suivre son avancement et être prévenu·e quand relancer.
      </p>
      <NewApplicationForm defaultDate={today()} aiEnabled={isClaudeConfigured()} />
    </main>
  );
}
