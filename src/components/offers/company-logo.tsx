"use client";

import Image from "next/image";
import { useState } from "react";

/** « Back Market » → « BM », « Doctolib » → « D ». */
function initials(name: string | null) {
  const words = (name ?? "").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

/**
 * Logo d'une entreprise (`src`), sinon `fallbackSrc` (logo de la source de l'offre), sinon
 * les initiales : quand le logo est inconnu (null) ou ne se charge pas (404 de Logo.dev).
 * Même style que l'avatar des candidatures du tableau de bord.
 */
export function CompanyLogo({
  name,
  src,
  fallbackSrc = null,
}: {
  name: string | null;
  src: string | null;
  fallbackSrc?: string | null;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const current = [src, fallbackSrc].find((url): url is string => Boolean(url) && !failed.includes(url!));

  if (current) {
    return (
      <Image
        key={current}
        src={current}
        alt=""
        width={36}
        height={36}
        unoptimized
        onError={() => setFailed((urls) => [...urls, current])}
        className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-200 dark:ring-slate-700"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/15 text-sm font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-500/20"
    >
      {initials(name)}
    </span>
  );
}
