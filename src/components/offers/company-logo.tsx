"use client";

import Image from "next/image";
import { useState } from "react";

/** « Back Market » → « BM », « Doctolib » → « D ». */
function initials(name: string | null) {
  const words = (name ?? "").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

/**
 * Logo d'une entreprise ; ses initiales si le logo est inconnu (`src` null) ou ne se
 * charge pas (404 de Logo.dev).
 */
export function CompanyLogo({ name, src, className = "h-7 w-7" }: { name: string | null; src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        unoptimized
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-md bg-white object-contain ring-1 ring-slate-200 dark:ring-slate-700`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700`}
    >
      {initials(name)}
    </span>
  );
}
