"use client";

import { IconMoon, IconSun } from "@/components/icons";

/**
 * Bascule mode clair / mode sombre (sidebar de l'app). Le choix est enregistré dans
 * localStorage (« theme ») et relu au chargement par le script du layout racine. L'icône et
 * le libellé suivent la classe « dark » en CSS (variante theme-dark : le choix réel, y compris
 * sur les éditeurs restés en clair) : aucun état React, donc aucun décalage avec le rendu serveur.
 */
export function ThemeToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  function toggle() {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour cette page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Changer de thème"
      className={`flex items-center gap-3 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
    >
      <IconMoon className="h-5 w-5 text-blue-600 theme-dark:hidden" />
      <IconSun className="hidden h-5 w-5 text-amber-400 theme-dark:block" />
      <span className={compact ? "sr-only" : ""}>
        <span className="theme-dark:hidden">Mode sombre</span>
        <span className="hidden theme-dark:inline">Mode clair</span>
      </span>
    </button>
  );
}
