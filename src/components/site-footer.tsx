import Link from "next/link";

import { LogoFull } from "@/components/logo";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/politique-confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

/** Pied de page commun à toutes les pages (masqué à l'impression : CV et lettres en PDF). */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <LogoFull className="h-7 w-auto" priority={false} />
          <p>© {new Date().getFullYear()} — Tous droits réservés</p>
        </div>
        <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
