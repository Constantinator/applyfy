import Link from "next/link";

import { LogoFull } from "@/components/logo";

// En-tête des pages publiques (landing, blog) : logo, navigation et inscription.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Applyfy, accueil">
          <LogoFull className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium sm:gap-6">
          <Link
            href="/#comment-ca-marche"
            className="hidden text-slate-600 hover:text-slate-900 sm:block"
          >
            Comment ça marche
          </Link>
          <Link href="/blog" className="text-slate-600 hover:text-slate-900">
            Blog
          </Link>
          <Link href="/about" className="hidden text-slate-600 hover:text-slate-900 sm:block">
            Notre histoire
          </Link>
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Se connecter
          </Link>
          {/* « gratuitement » masqué sous 360 px : le bouton tient sur les plus petits écrans. */}
          <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
            Commencer<span className="max-[359px]:hidden">&nbsp;gratuitement</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
