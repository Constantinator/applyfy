"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Bouton d'inscription fixe en bas de l'écran, sur mobile uniquement. Absent sans JavaScript.
 * Masqué tant qu'un bouton d'inscription de la page est visible, et une fois le dernier dépassé
 * (le pied de page reste accessible). Sous le bandeau cookies et le message de la démo (z-index).
 */
export function MobileCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    // Le lien du message de la démo, toujours « à l'écran » car en position fixe, ne compte pas.
    const targets = Array.from(document.querySelectorAll('main a[href="/signup"]')).filter(
      (link) => !link.closest('[role="status"]'),
    );
    const last = targets.at(-1);
    if (!last) return;

    const onScreen = new Set<Element>();
    let passedLast = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
        if (entry.target === last) passedLast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      }
      setVisible(onScreen.size === 0 && !passedLast);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-[translate,visibility] duration-200 motion-reduce:transition-none md:hidden ${
        visible ? "visible translate-y-0" : "invisible translate-y-full"
      }`}
    >
      <Link href="/signup" className="ui-btn-primary w-full">
        Créer mon CV gratuitement
      </Link>
    </div>
  );
}
