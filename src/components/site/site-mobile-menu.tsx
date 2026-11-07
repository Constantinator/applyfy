"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { IconMenu } from "@/components/icons";

/**
 * Menu burger des pages publiques. Un <details> : il s'ouvre aussi sans JavaScript ; le code ne sert
 * qu'à le refermer (lien choisi, clic à côté, Échap).
 */
export function SiteMobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => ref.current?.removeAttribute("open");
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !ref.current?.open) return;
      close();
      ref.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="relative -mr-2 lg:hidden">
      <summary
        aria-label="Menu"
        className="ui-focus flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-ink hover:bg-pill [&::-webkit-details-marker]:hidden"
      >
        <IconMenu className="h-6 w-6" />
      </summary>
      <nav
        aria-label="Navigation du site"
        onClick={() => ref.current?.removeAttribute("open")}
        className="absolute top-full right-0 z-40 mt-2 w-64 rounded-block border border-line bg-white p-1.5"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="ui-focus flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink hover:bg-pill"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
