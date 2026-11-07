import Link from "next/link";

import { ConsentSettingsLink } from "@/components/consent/ad-trackers";
import { BrandLogo } from "@/components/logo";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/politique-confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

const LINK = "ui-focus inline-flex min-h-11 items-center hover:text-ink md:min-h-0 dark:hover:text-white";

/** Pied de page commun à toutes les pages (masqué à l'impression : CV et lettres en PDF). */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white tracking-[-0.01em] print:hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 px-4 py-10 text-sm text-muted sm:px-8 md:flex-row md:justify-between dark:text-slate-400">
        <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4">
          <BrandLogo />
          <p>© {new Date().getFullYear()}</p>
        </div>
        <nav aria-label="Liens du site" className="flex flex-wrap items-center justify-center gap-x-6 md:gap-y-2">
          <Link href="/about" className={LINK}>
            Notre histoire
          </Link>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK}>
              {link.label}
            </Link>
          ))}
          <ConsentSettingsLink className={LINK} />
        </nav>
      </div>
    </footer>
  );
}
