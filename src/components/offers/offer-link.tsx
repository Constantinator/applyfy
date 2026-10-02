"use client";

import Link from "next/link";

/**
 * Lien qui sélectionne une offre (paramètre ?offre= de l'URL). Sur grand écran, le
 * panneau de détails s'ouvre à côté de la liste sans faire défiler la page. Sur mobile,
 * les détails remplacent la liste : on remonte en haut de la page.
 */
export function OfferLink({
  href,
  selected,
  className,
  children,
}: {
  href: string;
  selected: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      onClick={() => {
        if (!window.matchMedia("(min-width: 1024px)").matches) window.scrollTo({ top: 0 });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
