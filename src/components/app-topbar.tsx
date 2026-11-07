"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { logoutAction } from "@/app/actions/auth";
import {
  IconActivity,
  IconBriefcase,
  IconDocument,
  IconGrid,
  IconHome,
  IconLogout,
  IconMenu,
  IconPlus,
  IconPuzzle,
  IconSearch,
  IconSparkles,
  IconStar,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { FeedbackDialog, type FeedbackDialogHandle } from "@/components/feedback/feedback-dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DARK_MODE_ENABLED } from "@/lib/theme";
import { BrandLogo } from "@/components/logo";

import { isFullscreenPath, useAppNav } from "./app-nav-context";

type NavItem = {
  href: string;
  label: string;
  icon: typeof IconGrid;
  isActive: (path: string) => boolean;
};

const NEW_APPLICATION: NavItem = {
  href: "/candidatures/nouvelle",
  label: "Nouvelle candidature",
  icon: IconPlus,
  isActive: (p) => p === "/candidatures/nouvelle",
};

const PROFILE: NavItem = {
  href: "/profil",
  label: "Mon profil",
  icon: IconUser,
  isActive: (p) => p.startsWith("/profil"),
};

/** Dans le menu du compte : la barre n'a pas la place de ce lien à 1024 px. */
const EXTENSION: NavItem = {
  href: "/extension",
  label: "Extension Chrome",
  icon: IconPuzzle,
  isActive: (p) => p.startsWith("/extension"),
};

const PREMIUM: NavItem = {
  href: "/premium",
  label: "Premium",
  icon: IconSparkles,
  isActive: (p) => p.startsWith("/premium"),
};

/** Liens de la barre, dans l'ordre de la navigation de l'application. */
const BAR_LINKS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: IconGrid,
    isActive: (p) => p === "/dashboard",
  },
  {
    href: "/candidatures",
    label: "Candidatures",
    icon: IconBriefcase,
    // Les fiches candidature appartiennent à cette section.
    isActive: (p) => p === "/candidatures" || (p.startsWith("/candidatures/") && p !== "/candidatures/nouvelle"),
  },
  {
    href: "/offres",
    label: "Trouver une offre",
    icon: IconSearch,
    isActive: (p) => p.startsWith("/offres"),
  },
  {
    href: "/cv-builder",
    label: "CV Builder",
    icon: IconDocument,
    isActive: (p) => p.startsWith("/cv-builder"),
  },
];

/** Rapports du programme beta : beta testeurs actifs uniquement, en lien direct. */
const BETA_ITEM: NavItem = {
  href: "/beta",
  label: "Beta testing",
  icon: IconStar,
  isActive: (p) => p.startsWith("/beta"),
};

/** Liens admin, dans le menu « Plus » (l'accès est vérifié par les pages elles-mêmes). */
const ADMIN_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Admin",
    icon: IconActivity,
    isActive: (p) => p.startsWith("/admin") && !p.startsWith("/admin/beta") && !p.startsWith("/admin/roadmap"),
  },
  {
    href: "/admin/beta",
    label: "Beta testeurs",
    icon: IconUsers,
    isActive: (p) => p.startsWith("/admin/beta"),
  },
  {
    href: "/admin/roadmap",
    label: "Roadmap",
    icon: IconDocument,
    isActive: (p) => p.startsWith("/admin/roadmap"),
  },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const UNREAD_BADGE = "rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white";
const MENU_ITEM = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-pill dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS}`;
const MENU_ITEM_ACTIVE = "bg-pill font-medium dark:bg-slate-800 dark:text-white";
const PANEL_SECONDARY_ITEM = `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS}`;

/** Compteur affiché dans un badge : « 99+ » à partir de 100, pour que la barre ne déborde pas. */
const badgeCount = (count: number) => (count >= 100 ? "99+" : String(count));

function UnreadBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`${UNREAD_BADGE} ${className}`}>
      <span aria-hidden="true">{badgeCount(count)}</span>
      <span className="sr-only">{count}</span>
      <span className="sr-only"> message{count > 1 ? "s" : ""} non lu{count > 1 ? "s" : ""}</span>
    </span>
  );
}

function DemoBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30">
      Mode démo
    </span>
  );
}

export function AppTopbar({
  email,
  initials = "",
  isAdmin = false,
  isBetaTester = false,
  unreadBeta = 0,
  unreadAdmin = 0,
}: {
  email: string | null;
  /** Initiales de l'avatar (vide : icône). */
  initials?: string;
  isAdmin?: boolean;
  /** Beta testeur actif : lien « Beta testing ». */
  isBetaTester?: boolean;
  /** Messages de l'équipe non lus (lien « Beta testing »). */
  unreadBeta?: number;
  /** Messages des beta testeurs non lus (lien « Beta testeurs », admin). */
  unreadAdmin?: number;
}) {
  const pathname = usePathname();
  const appNav = useAppNav();
  const [panelOpen, setPanelOpen] = useState(false);
  const feedback = useRef<FeedbackDialogHandle>(null);
  const isDemo = email === null;
  const fullscreen = isFullscreenPath(pathname);

  // Messages non lus de la messagerie beta : badge rouge sur le lien concerné.
  const unread: Record<string, number> = { "/beta": unreadBeta, "/admin/beta": unreadAdmin };
  const barLinks = isBetaTester ? [...BAR_LINKS, BETA_ITEM] : BAR_LINKS;
  // Panneau : les liens de la barre, puis ceux des menus, à plat.
  const panelLinks = [...barLinks, PROFILE, EXTENSION, ...(isAdmin ? ADMIN_ITEMS : [])];
  // Beta + admin : six entrées, la barre ne tient à 1024 px qu'avec un bouton plus court.
  const compactNewApplication = isAdmin && isBetaTester;

  // Le panneau mobile n'a plus lieu d'être si l'écran s'élargit (rotation, fenêtre).
  useEffect(() => {
    if (!panelOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) setPanelOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [panelOpen]);

  const logo = (size: "sm" | "md") => (
    <Link href="/dashboard" aria-label="Applyfy, tableau de bord" className={`inline-flex min-h-11 shrink-0 items-center rounded-lg ${FOCUS}`}>
      <BrandLogo size={size} />
    </Link>
  );

  const openFeedback = () => feedback.current?.open();

  // Contenu du panneau : mobile, et « Menu » de l'éditeur en plein écran.
  const panelContent = (
    <>
      <div className="px-5 pt-5 pb-4">{logo("md")}</div>

      <div className="px-3 pb-3">
        <Link
          href={NEW_APPLICATION.href}
          aria-current={NEW_APPLICATION.isActive(pathname) ? "page" : undefined}
          className="ui-btn-primary w-full px-4 py-2"
        >
          <IconPlus className="h-4 w-4" />
          {NEW_APPLICATION.label}
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 space-y-1 px-3">
        {panelLinks.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors ${FOCUS} ${
                active
                  ? "bg-pill text-ink dark:bg-slate-800 dark:text-white"
                  : "text-muted hover:bg-pill hover:text-ink dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              <UnreadBadge count={unread[item.href] ?? 0} className="ml-auto" />
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 space-y-1 border-t border-line-soft p-3 dark:border-slate-800">
        <Link
          href={PREMIUM.href}
          aria-current={PREMIUM.isActive(pathname) ? "page" : undefined}
          className={PANEL_SECONDARY_ITEM}
        >
          <IconSparkles className="h-5 w-5" />
          {PREMIUM.label}
        </Link>
        {!isDemo && (
          <button type="button" onClick={openFeedback} className={PANEL_SECONDARY_ITEM}>
            <IconStar className="h-5 w-5" />
            Donner mon avis
          </button>
        )}
        <Link href="/" className={PANEL_SECONDARY_ITEM}>
          <IconHome className="h-5 w-5" />
          Retour à l&apos;accueil
        </Link>
        {DARK_MODE_ENABLED && <ThemeToggle className="min-h-11 w-full px-3 py-2" />}
        {isDemo ? (
          <p className="px-3 py-2">
            <DemoBadge />
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-3 py-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted dark:text-slate-300" title={email}>
              {email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${FOCUS}`}
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );

  // Éditeur en plein écran : ni barre ni en-tête, la navigation s'ouvre dans un panneau.
  if (fullscreen) {
    return (
      <>
        <MenuDrawer open={appNav.menuOpen} onClose={appNav.closeMenu} canLeave={appNav.canLeave}>
          {panelContent}
        </MenuDrawer>
        {!isDemo && <FeedbackDialog ref={feedback} />}
      </>
    );
  }

  const adminActive = ADMIN_ITEMS.some((item) => item.isActive(pathname));
  const accountItems = [PROFILE, EXTENSION, PREMIUM];
  const accountActive = accountItems.some((item) => item.isActive(pathname));
  const barLink = (active: boolean) =>
    `flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${FOCUS} ${
      active
        ? "bg-pill text-ink dark:bg-slate-800 dark:text-white"
        : "text-muted hover:text-ink dark:text-slate-300 dark:hover:text-white"
    }`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
          {logo("sm")}

          {/* Grand écran : liens dans la barre. */}
          <nav aria-label="Navigation principale" className="hidden items-center gap-0.5 lg:flex">
            {barLinks.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={barLink(active)}
                >
                  {item.label}
                  <UnreadBadge count={unread[item.href] ?? 0} />
                </Link>
              );
            })}
            {isAdmin && (
              <NavDropdown
                label={`Plus${unreadAdmin > 0 ? `, ${unreadAdmin} message${unreadAdmin > 1 ? "s" : ""} non lu${unreadAdmin > 1 ? "s" : ""}` : ""}`}
                triggerClassName={barLink(adminActive)}
                trigger={
                  <>
                    Plus
                    <Chevron />
                    {unreadAdmin > 0 && (
                      <span aria-hidden="true" className={UNREAD_BADGE}>
                        {badgeCount(unreadAdmin)}
                      </span>
                    )}
                  </>
                }
                panelClassName="left-0 w-56"
              >
                {ADMIN_ITEMS.map((item) => {
                  const active = item.isActive(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`${MENU_ITEM} ${active ? MENU_ITEM_ACTIVE : ""}`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                      <UnreadBadge count={unread[item.href] ?? 0} className="ml-auto" />
                    </Link>
                  );
                })}
              </NavDropdown>
            )}
          </nav>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <Link
              href={NEW_APPLICATION.href}
              aria-current={NEW_APPLICATION.isActive(pathname) ? "page" : undefined}
              aria-label={compactNewApplication ? NEW_APPLICATION.label : undefined}
              className="ui-btn-primary px-4 py-2"
            >
              <IconPlus className="h-4 w-4" />
              {compactNewApplication ? (
                <span>
                  Nouvelle<span className="hidden xl:inline"> candidature</span>
                </span>
              ) : (
                NEW_APPLICATION.label
              )}
            </Link>

            <NavDropdown
              label="Menu du compte"
              triggerClassName={`flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white hover:bg-ink-hover dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 ${FOCUS} ${
                accountActive ? "ring-2 ring-ink ring-offset-2 dark:ring-white dark:ring-offset-slate-900" : ""
              }`}
              trigger={initials ? <span aria-hidden="true">{initials}</span> : <IconUser className="h-5 w-5" />}
              panelClassName="right-0 w-64"
            >
              <div className="truncate px-3 pt-1 pb-2 text-xs text-muted dark:text-slate-400" title={email ?? undefined}>
                {isDemo ? <DemoBadge /> : email}
              </div>
              {accountItems.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`${MENU_ITEM} ${active ? MENU_ITEM_ACTIVE : ""}`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              {!isDemo && (
                <button type="button" onClick={openFeedback} className={MENU_ITEM}>
                  <IconStar className="h-5 w-5" />
                  Donner mon avis
                </button>
              )}
              <Link href="/" className={MENU_ITEM}>
                <IconHome className="h-5 w-5" />
                Retour à l&apos;accueil
              </Link>
              {DARK_MODE_ENABLED && <ThemeToggle className={MENU_ITEM} />}
              {!isDemo && (
                <form action={logoutAction} className="mt-1 border-t border-line-soft pt-1 dark:border-slate-800">
                  <button type="submit" className={MENU_ITEM}>
                    <IconLogout className="h-5 w-5" />
                    Se déconnecter
                  </button>
                </form>
              )}
            </NavDropdown>
          </div>

          {/* Mobile : burger, tous les liens sont dans le panneau. */}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            aria-label="Ouvrir le menu"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            className={`-mr-2 ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-pill lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS}`}
          >
            <IconMenu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MenuDrawer open={panelOpen} onClose={() => setPanelOpen(false)} canLeave={appNav.canLeave} side="right">
        {panelContent}
      </MenuDrawer>
      {/* Hors de la barre et du menu : une fenêtre ne s'affiche pas dans un parent masqué. */}
      {!isDemo && <FeedbackDialog ref={feedback} />}
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Menu déroulant de la barre : Tab et flèches pour parcourir les entrées, Échap pour fermer (le
 * focus revient au bouton), fermeture au clic sur une entrée, en dehors ou en quittant le menu.
 * Le contenu reste monté : un formulaire retiré du DOM pendant le clic ne serait pas envoyé.
 */
function NavDropdown({
  label,
  trigger,
  triggerClassName,
  panelClassName,
  rootClassName = "",
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  triggerClassName: string;
  panelClassName: string;
  rootClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      setOpen(false);
      button.current?.focus();
      return;
    }
    const opening = !open && (e.key === "ArrowDown" || e.key === "ArrowUp");
    if (!opening && !(open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))) return;
    e.preventDefault();
    if (opening) flushSync(() => setOpen(true));
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? last
          : e.key === "ArrowDown"
            ? current < last ? current + 1 : 0
            : current > 0 ? current - 1 : last;
    items[next].focus();
  }

  return (
    <div
      ref={root}
      className={`relative ${rootClassName}`}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Focus parti ailleurs dans la page (Tab) : fermeture.
        if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        ref={panel}
        hidden={!open}
        // Avant l'action de l'entrée : le focus revient au bouton (et s'y retrouve après la
        // fermeture de la fenêtre « Donner mon avis »).
        onClickCapture={(e) => {
          if (!(e.target as HTMLElement).closest("a[href], button")) return;
          button.current?.focus();
          setOpen(false);
        }}
        className={`absolute top-full z-40 mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-block border border-line bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Navigation de l'application dans un panneau par-dessus la page (mobile, pages en plein écran).
 * Avant de quitter la page (lien, déconnexion), la garde de la page est consultée : modifications
 * non enregistrées, confirmation.
 */
function MenuDrawer({
  open,
  onClose,
  canLeave,
  side = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  canLeave: () => boolean;
  side?: "left" | "right";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClose={onClose}
      // Clic sur le fond (hors du panneau) : fermeture.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClickCapture={(e) => {
        if (!(e.target as HTMLElement).closest("a[href]")) return;
        if (!canLeave()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClose();
      }}
      onSubmitCapture={(e) => {
        if (!canLeave()) e.preventDefault();
      }}
      className={`m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 text-left shadow-xl backdrop:bg-slate-900/40 dark:bg-slate-900 print:hidden ${
        side === "right" ? "ml-auto" : ""
      }`}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className={`absolute top-3 right-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS}`}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  );
}
