import Link from "next/link";

import { isSupabaseConfigured } from "@/lib/supabase/server";

// Layout des pages de connexion / inscription.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
          A
        </span>
        Applyfy
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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

      <Link href="/" className="mt-6 text-sm text-slate-500 hover:text-slate-900">
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}
