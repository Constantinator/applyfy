"use client";

import Image from "next/image";
import { useState } from "react";

/** « Back Market » → « BM », « Doctolib » → « D ». */
function initials(name: string | null) {
  const words = (name ?? "").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

const SIZES = {
  36: "h-9 w-9 text-sm rounded-xl",
  44: "h-11 w-11 text-base rounded-xl",
  48: "h-12 w-12 text-lg rounded-xl",
  56: "h-14 w-14 text-xl rounded-[14px]",
} as const;

/** 56 px dès 640 px de large, 44 px en dessous (en-tête de la fiche candidature). */
const RESPONSIVE_56 = "h-11 w-11 text-base rounded-[14px] sm:h-14 sm:w-14 sm:text-xl";

/** Carré blanc avec liseré, blanc aussi en mode sombre (logos à fond transparent). */
const TILE = "shrink-0 bg-white ring-1 ring-line";

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
  mobileSize,
}: {
  name: string | null;
  src: string | null;
  fallbackSrc?: string | null;
  size?: keyof typeof SIZES;
  /** Taille sous 640 px de large (seulement 44 avec size 56). */
  mobileSize?: 44;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const box = size === 56 && mobileSize === 44 ? RESPONSIVE_56 : SIZES[size];
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
        className={`${box} ${TILE} object-contain`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${box} ${TILE} flex items-center justify-center font-bold text-ink`}>
      {initials(name)}
    </span>
  );
}
