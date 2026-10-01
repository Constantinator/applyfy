"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Zone de hauteur limitée (défilement interne) avec un bouton « Voir plus / Voir moins ».
 * Le bouton n'apparaît que si le contenu dépasse la hauteur maximale.
 */
export function CollapsibleBox({
  maxHeight = 200,
  label,
  children,
}: {
  /** Hauteur maximale repliée, en pixels. */
  maxHeight?: number;
  /** Ce que contient la zone (pour les lecteurs d'écran), ex. « la description de l'offre ». */
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  // Le contenu dépasse-t-il ? On observe le contenu (et non la zone, plafonnée) : sa
  // hauteur change avec la largeur de l'écran et au chargement des polices web.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      setOverflowing(content.offsetHeight > maxHeight + 1);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [maxHeight]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      // Repliée : revient en haut du texte, et ramène la zone à l'écran si besoin.
      boxRef.current?.scrollTo({ top: 0 });
      setAtBottom(false);
      boxRef.current?.scrollIntoView({ block: "nearest" });
    }
  }

  const collapsed = !expanded && overflowing;

  return (
    <div>
      <div className="relative">
        <div
          ref={boxRef}
          id={id}
          // Zone défilante atteignable au clavier quand elle est repliée.
          tabIndex={collapsed ? 0 : undefined}
          role={collapsed ? "region" : undefined}
          aria-label={collapsed ? label : undefined}
          onScroll={(e) => {
            const box = e.currentTarget;
            setAtBottom(box.scrollTop + box.clientHeight >= box.scrollHeight - 4);
          }}
          style={expanded ? undefined : { maxHeight }}
          className={`rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none ${
            expanded ? "" : "overflow-y-auto overscroll-contain pr-2"
          }`}
        >
          <div ref={contentRef}>{children}</div>
        </div>
        {/* Fondu en bas : il reste du texte à lire */}
        {collapsed && !atBottom && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          {expanded ? "Voir moins" : "Voir plus"}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
        </button>
      )}
    </div>
  );
}
