import Link from "next/link";

import { Logo } from "@/components/logo";

// Pages légales (mentions légales, confidentialité, CGU) : publiques, sans sidebar.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Applyfy, accueil">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
    </div>
  );
}
