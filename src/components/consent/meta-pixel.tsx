"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { OPEN_CONSENT_EVENT, readConsent, saveConsent, type Consent } from "./consent";

const META_PIXEL_ID = "1738090957248394";

// Code officiel du Meta Pixel : chargé uniquement après acceptation des cookies.
const META_PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`;

type Fbq = (command: "track", event: "PageView") => void;

/**
 * Bandeau de consentement + Meta Pixel. Tant que le visiteur n'a pas accepté, aucun script
 * Meta n'est chargé et aucun cookie publicitaire n'est déposé.
 */
export function MetaPixel() {
  // undefined : pas encore lu (rendu serveur et premier rendu) ; null : choix à faire.
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Lecture différée : localStorage n'existe que dans le navigateur.
    const timer = window.setTimeout(() => setConsent(readConsent()), 0);
    const reopen = () => setConsent(null);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  // Navigation entre pages sans rechargement : une page vue par changement d'adresse (la
  // première est envoyée par le code du Pixel lui-même).
  useEffect(() => {
    if (consent !== "granted") return;
    if (lastPath.current !== null && lastPath.current !== pathname) {
      (window as unknown as { fbq?: Fbq }).fbq?.("track", "PageView");
    }
    lastPath.current = pathname;
  }, [consent, pathname]);

  function choose(value: Consent) {
    const wasGranted = readConsent() === "granted";
    saveConsent(value);
    // Retrait du consentement : recharger pour décharger le Pixel déjà présent.
    if (wasGranted && value === "denied") {
      window.location.reload();
      return;
    }
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: META_PIXEL_SNIPPET }}
        />
      )}
      {consent === null && (
        <div
          role="dialog"
          aria-labelledby="consent-title"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 print:hidden"
        >
          <p id="consent-title" className="text-sm font-semibold text-slate-900">
            Cookies publicitaires
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Avec ton accord, Applyfy utilise le pixel de Meta (Facebook, Instagram) pour mesurer
            l&apos;efficacité de ses publicités. Tu peux changer d&apos;avis à tout moment depuis le
            pied de page.{" "}
            <Link
              href="/politique-confidentialite"
              className="font-medium text-blue-600 underline-offset-4 hover:underline"
            >
              En savoir plus
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => choose("denied")}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => choose("granted")}
              className="btn-primary px-4 py-2 text-sm"
            >
              Accepter
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Lien du pied de page : rouvre le bandeau pour modifier son choix. */
export function ConsentSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      Gestion des cookies
    </button>
  );
}
