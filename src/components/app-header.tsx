import Link from "next/link";

import { logoutAction } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth";

export function AppHeader({ user }: { user: CurrentUser | null }) {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              A
            </span>
            <span className="hidden sm:inline">Applyfy</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium whitespace-nowrap text-slate-600 hover:text-slate-900"
          >
            ← <span className="hidden sm:inline">Retour à l&apos;accueil</span>
            <span className="sm:hidden">Accueil</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/profil"
            title={user?.email ?? undefined}
            className="text-sm font-medium whitespace-nowrap text-slate-600 hover:text-slate-900"
          >
            Mon profil
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  Se déconnecter
                </button>
              </form>
            </div>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              Démo
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
