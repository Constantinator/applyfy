"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { LumeoAvatar } from "@/components/lumeo/lumeo-avatar";
import {
  LUMEO_STORAGE_PREFIX,
  isLumeoHidden,
  isShownOnce,
  localDay,
  lumeoBannerContent,
  lumeoMessageKey,
  type LumeoDashboardMessage,
} from "@/lib/lumeo-dashboard";
import { LUMEO_DASHBOARD_TEXTS } from "@/lib/lumeo-texts";

// Valeurs lues au premier affichage de la visite : la marque « vue » de la carte verte,
// enregistrée à l'affichage, ne la fait pas disparaître sous les yeux de l'utilisateur.
const readAtLoad = new Map<string, string | null>();
// « Plus tard » sans stockage disponible (navigation privée stricte…) : masqué pour la visite.
const laterForVisit = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStored(key: string): string | null {
  if (!readAtLoad.has(key)) {
    let value: string | null = null;
    try {
      value = window.localStorage.getItem(LUMEO_STORAGE_PREFIX + key);
    } catch {
      // Stockage indisponible : le bandeau s'affiche normalement.
    }
    readAtLoad.set(key, value);
  }
  return readAtLoad.get(key) ?? null;
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(LUMEO_STORAGE_PREFIX + key, value);
  } catch {
    // Rien à faire : au pire, le bandeau revient à la prochaine visite.
  }
}

/** Bandeau de Lumeo : un message, « Plus tard » jusqu'à demain. N'écrit que dans le navigateur. */
export function LumeoBanner({ message }: { message: LumeoDashboardMessage }) {
  const key = lumeoMessageKey(message);
  // Côté serveur : affiché ; un bandeau déjà masqué est caché avant l'affichage par
  // LUMEO_PREPAINT_SCRIPT (layout racine), la page ne saute donc pas.
  const hidden = useSyncExternalStore(
    subscribe,
    () => laterForVisit.has(key) || isLumeoHidden(message, readStored(key), localDay(new Date())),
    () => false,
  );

  // Carte verte : marquée « vue » dès qu'elle s'affiche, elle ne reviendra plus.
  useEffect(() => {
    if (!hidden && isShownOnce(message)) write(key, localDay(new Date()));
  }, [hidden, key, message]);

  if (hidden) return null;

  const content = lumeoBannerContent(message);
  const success = content.tone === "success";
  const titleId = `lumeo-banner-${message.kind}`;

  function later() {
    laterForVisit.add(key);
    write(key, localDay(new Date()));
    listeners.forEach((listener) => listener());
  }

  return (
    <section
      aria-labelledby={titleId}
      data-lumeo-key={key}
      className={`animate-card-in flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 ${
        success
          ? "border-[#D4EBDA] bg-[#F3FAF5] dark:border-emerald-900 dark:bg-emerald-950/40"
          : "border-line bg-[#F7F7F8] dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <LumeoAvatar size={72} expression={content.expression} celebrate={success} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-[0.08em] text-[#2563EB] dark:text-blue-400">
          {LUMEO_DASHBOARD_TEXTS.label}
        </p>
        <h2 id={titleId} className="mt-1 text-lg leading-snug font-semibold break-words text-ink dark:text-white">
          {content.title}
        </h2>
        <p className="mt-1 text-sm text-muted dark:text-slate-300">{content.detail}</p>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center">
        {/* Bienvenue : « Plus tard » en lien discret, sous les boutons sur mobile, à leur gauche sinon. */}
        <button
          type="button"
          onClick={later}
          className={
            content.secondary
              ? "ui-focus order-last inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-muted hover:text-ink sm:order-first dark:text-slate-400 dark:hover:text-white"
              : "ui-btn-secondary w-full sm:w-auto"
          }
        >
          {LUMEO_DASHBOARD_TEXTS.later}
        </button>
        {content.secondary && (
          <Link href={content.secondary.href} className="ui-btn-secondary w-full sm:w-auto">
            {content.secondary.label}
          </Link>
        )}
        <Link href={content.primary.href} className="ui-btn-primary w-full sm:w-auto">
          {content.primary.label}
        </Link>
      </div>
    </section>
  );
}
