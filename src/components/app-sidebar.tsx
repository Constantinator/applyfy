"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { IconActivity, IconGrid, IconHome, IconLogout, IconPlus, IconSearch, IconUser } from "@/components/icons";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { Logo } from "@/components/logo";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof IconGrid;
  isActive: (path: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    shortLabel: "Candidatures",
    icon: IconGrid,
    // Les fiches candidature appartiennent à cette section.
    isActive: (p) => p === "/dashboard" || (p.startsWith("/candidatures/") && p !== "/candidatures/nouvelle"),
  },
  {
    href: "/offres",
    label: "Trouver une offre",
    shortLabel: "Offres",
    icon: IconSearch,
    isActive: (p) => p.startsWith("/offres"),
  },
  {
    href: "/candidatures/nouvelle",
    label: "Nouvelle candidature",
    shortLabel: "Ajouter",
    icon: IconPlus,
    isActive: (p) => p === "/candidatures/nouvelle",
  },
  {
    href: "/profil",
    label: "Mon profil",
    shortLabel: "Profil",
    icon: IconUser,
    isActive: (p) => p.startsWith("/profil"),
  },
];

/** Lien du tableau de bord admin (l'accès est vérifié par la page elle-même). */
const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  shortLabel: "Admin",
  icon: IconActivity,
  isActive: (p) => p.startsWith("/admin"),
};

export function AppSidebar({ email, isAdmin = false }: { email: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const isDemo = email === null;
  const nav = isAdmin ? [...NAV, ADMIN_ITEM] : NAV;

  return (
    <>
      {/* Mobile : barre supérieure compacte */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden print:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Applyfy, tableau de bord">
            <Logo size="sm" />
          </Link>
          {isDemo ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Démo
            </span>
          ) : (
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                Se déconnecter
              </button>
            </form>
          )}
        </div>
        <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Desktop : sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        <div className="px-5 pt-6 pb-8">
          <Link href="/dashboard" aria-label="Applyfy, tableau de bord">
            <Logo />
          </Link>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3">
          {!isDemo && <FeedbackDialog />}
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          >
            <IconHome className="h-5 w-5 text-slate-400" />
            Retour à l&apos;accueil
          </Link>
          {isDemo ? (
            <p className="px-3 py-2">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Mode démo
              </span>
            </p>
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2">
              <span className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white uppercase">
                {email.charAt(0)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={email}>
                {email}
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Se déconnecter"
                  aria-label="Se déconnecter"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <IconLogout className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
