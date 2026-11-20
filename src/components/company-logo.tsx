"use client";

import Image from "next/image";
import { useState } from "react";

/** « Back Market » → « BM », « Doctolib » → « D ». */
function initials(name: string | null) {
  const words = (name ?? "").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

const SIZES = {
  36: "h-9 w-9 text-sm",
  44: "h-11 w-11 text-base",
  48: "h-12 w-12 text-lg",
} as const;

/** Carré blanc avec liseré, blanc aussi en mode sombre (logos à fond transparent). */
const TILE = "shrink-0 rounded-xl bg-white ring-1 ring-line";

/**
 * Logo d'une entreprise (`src`, adresse Logo.dev calculée côté serveur), sinon `fallbackSrc`
 * (logo de la source de l'offre), sinon les initiales : quand le logo est inconnu (null) ou ne
 * se charge pas (404 de Logo.dev, quota dépassé). Chargé directement par le navigateur, jamais
 * relayé par notre serveur ; le Referer se limite à l'origine (https://www.applyfy.fr), sans le
 * chemin de la page, et suffit à la restriction de la clé Logo.dev par domaine.
 */
export function CompanyLogo({
  name,
  src,
  fallbackSrc = null,
  size = 36,
}: {
  name: string | null;
  src: string | null;
  fallbackSrc?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const current = [src, fallbackSrc].find((url): url is string => Boolean(url) && !failed.includes(url!));

  if (current) {
    return (
      <Image
        key={current}
        src={current}
        alt=""
        width={size}
        height={size}
        unoptimized
        loading="lazy"
        referrerPolicy="origin"
        onError={() => setFailed((urls) => [...urls, current])}
        className={`${SIZES[size]} ${TILE} object-contain`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${SIZES[size]} ${TILE} flex items-center justify-center font-bold text-ink`}>
      {initials(name)}
    </span>
  );
}
