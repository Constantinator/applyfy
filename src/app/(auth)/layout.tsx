import Link from "next/link";

import { BrandMark } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Layout des pages de connexion / inscription.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center bg-white px-4 pt-12 pb-16 sm:pt-16">
      <div className="ui-card w-full max-w-[440px] px-5 py-7 sm:px-8 sm:py-9">
        <Link
          href="/"
          aria-label="Applyfy, accueil"
          className="ui-focus mx-auto flex h-11 w-11 items-center justify-center rounded-block"
        >
          <BrandMark />
        </Link>
        {!isSupabaseConfigured() && (
          <p className="ui-notice mt-3 px-3 py-2 text-sm">
            Supabase n&apos;est pas configuré : les comptes sont désactivés.{" "}
            <Link href="/dashboard" className="font-medium underline">
              Voir le dashboard de démo
            </Link>
          </p>
        )}
        {children}
      </div>

      <Link href="/" className="ui-focus mt-3 inline-flex min-h-11 items-center text-[13px] text-muted hover:text-ink">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
