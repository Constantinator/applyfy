import Link from "next/link";

import { Logo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Layout des pages de connexion / inscription.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),rgba(6,182,212,0.08)_45%,transparent_70%)]"
      />
      <Link href="/" aria-label="Applyfy, accueil" className="relative mb-8">
        <Logo size="lg" />
      </Link>

      <div className="card relative w-full max-w-md p-6 sm:p-8">
        {!isSupabaseConfigured() && (
          <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Supabase n&apos;est pas configuré : les comptes sont désactivés.{" "}
            <Link href="/dashboard" className="font-medium underline">
              Voir le dashboard de démo
            </Link>
          </p>
        )}
        {children}
      </div>

      <Link href="/" className="relative mt-6 text-sm text-slate-500 hover:text-slate-900">
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}
