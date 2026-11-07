import Link from "next/link";

import { BrandLogo } from "@/components/logo";
import { SiteMobileMenu } from "@/components/site/site-mobile-menu";

// Chemins complets (/#…) : l'en-tête sert aussi au blog, à « Notre histoire » et aux pages légales.
const NAV_LINKS = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/blog", label: "Blog" },
];

const LOGIN = { href: "/login", label: "Se connecter" };

// En-tête des pages publiques (landing, blog) : logo, navigation et inscription.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/92 tracking-[-0.01em] backdrop-blur-[8px]">
      <div className="mx-auto flex h-[60px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-8 lg:h-[68px]">
        <div className="flex items-center gap-9">
          <Link href="/" aria-label="Applyfy, accueil" className="ui-focus inline-flex min-h-11 items-center rounded-lg">
            <BrandLogo />
          </Link>
          <nav aria-label="Navigation du site" className="hidden items-center gap-1.5 text-sm font-medium text-nav lg:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="ui-focus rounded-full px-3.5 py-2 hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 lg:gap-[18px]">
          <Link href={LOGIN.href} className="ui-focus hidden rounded-full text-sm font-medium text-nav hover:text-ink lg:block">
            {LOGIN.label}
          </Link>
          <Link href="/signup" className="ui-btn-primary max-lg:px-4 max-lg:text-[13px]">
            <span>
              Commencer<span className="hidden lg:inline"> gratuitement</span>
            </span>
          </Link>
          <SiteMobileMenu links={[...NAV_LINKS, LOGIN]} />
        </div>
      </div>
    </header>
  );
}
