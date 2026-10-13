import Link from "next/link";

import { ConsentSettingsLink } from "@/components/consent/ad-trackers";
import { LogoFull } from "@/components/logo";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/politique-confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

/** Pied de page commun à toutes les pages (masqué à l'impression : CV et lettres en PDF). */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <LogoFull className="h-7 w-auto" priority={false} />
          <p>© {new Date().getFullYear()} — Tous droits réservés</p>
        </div>
        <nav aria-label="Liens du site" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-slate-900 dark:hover:text-white">
            Notre histoire
          </Link>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-900 dark:hover:text-white">
              {link.label}
            </Link>
          ))}
          <ConsentSettingsLink className="hover:text-slate-900 dark:hover:text-white" />
        </nav>
      </div>
    </footer>
  );
}
