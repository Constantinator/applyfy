"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// Navigation de l'application pour les pages en plein écran (éditeur du CV Builder) : la
// barre latérale y est remplacée par un panneau « Menu » ouvert par la page, et la page peut
// demander confirmation avant de quitter (modifications non enregistrées).

/** Pages en plein écran : l'éditeur d'un CV du CV Builder (/cv-builder/<id>). */
export function isFullscreenPath(pathname: string) {
  return /^\/cv-builder\/[^/]+$/.test(pathname) && pathname !== "/cv-builder/importer";
}

/** Garde de sortie : true si l'utilisateur peut quitter la page (sinon, il reste). */
type LeaveGuard = () => boolean;

type AppNav = {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  /** Garde de la page affichée (null : pas de garde). */
  setLeaveGuard: (guard: LeaveGuard | null) => void;
  /** Avant une navigation : la garde de la page autorise-t-elle la sortie ? */
  canLeave: () => boolean;
};

const AppNavContext = createContext<AppNav | null>(null);

export function AppNavProvider({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const guard = useRef<LeaveGuard | null>(null);
  const setLeaveGuard = useCallback((next: LeaveGuard | null) => {
    guard.current = next;
  }, []);
  const value = useMemo<AppNav>(
    () => ({
      menuOpen,
      openMenu: () => setMenuOpen(true),
      closeMenu: () => setMenuOpen(false),
      setLeaveGuard,
      canLeave: () => guard.current?.() ?? true,
    }),
    [menuOpen, setLeaveGuard],
  );
  return <AppNavContext.Provider value={value}>{children}</AppNavContext.Provider>;
}

export function useAppNav() {
  const nav = useContext(AppNavContext);
  if (!nav) throw new Error("useAppNav doit être utilisé dans AppNavProvider");
  return nav;
}
