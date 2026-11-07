import Link from "next/link";

import { BrandLogo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Layout des pages de connexion / inscription.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-4 py-12">
      <Link href="/" aria-label="Applyfy, accueil" className="ui-focus relative mb-8 inline-flex min-h-11 items-center rounded-block">
        <BrandLogo />
      </Link>

      <div className="ui-card relative w-full max-w-md p-5 sm:p-7">
        {!isSupabaseConfigured() && (
          <p className="ui-notice mb-6 px-3 py-2 text-sm">
            Supabase n&apos;est pas configuré : les comptes sont désactivés.{" "}
            <Link href="/dashboard" className="font-medium underline">
              Voir le dashboard de démo
            </Link>
          </p>
        )}
        {children}
      </div>

      <Link href="/" className="ui-focus relative mt-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
