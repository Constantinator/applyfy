import Link from "next/link";

import { BrandLogo } from "@/components/logo";

// En-tête des pages publiques (landing, blog) : logo, navigation et inscription.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Applyfy, accueil">
          <BrandLogo />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium text-nav sm:gap-6">
          <Link
            href="/#comment-ca-marche"
            className="hidden hover:text-ink sm:block"
          >
            Comment ça marche
          </Link>
          <Link href="/blog" className="hidden hover:text-ink min-[400px]:block">
            Blog
          </Link>
          <Link href="/about" className="hidden hover:text-ink sm:block">
            Notre histoire
          </Link>
          <Link href="/login" className="whitespace-nowrap hover:text-ink">
            Se connecter
          </Link>
          {/*
            « gratuitement » masqué sous 520 px : le bouton tient sur les plus petits écrans. Un seul
            <span> autour du texte : sinon le gap du bouton (inline-flex) s'ajoute à l'espace.
          */}
          <Link href="/signup" className="ui-btn-primary max-sm:px-3.5 lg:min-h-0! lg:px-4! lg:py-[9px]! lg:text-[13px]!">
            <span>
              Commencer<span className="max-[519px]:hidden"> gratuitement</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
