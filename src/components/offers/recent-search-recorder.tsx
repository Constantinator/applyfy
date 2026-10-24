"use client";

import { useEffect } from "react";

import type { ContractFilter } from "@/lib/offer-types";
import {
  RECENT_SEARCHES_COOKIE,
  RECENT_SEARCH_MAX_AGE_DAYS,
  addRecentSearch,
  parseRecentSearches,
} from "@/lib/recent-searches";

function readCookie(name: string) {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Mémorise la recherche affichée (cookie) pour les recommandations personnalisées. */
export function RecentSearchRecorder({
  keywords,
  place,
  contract,
}: {
  keywords: string;
  place: string;
  contract: ContractFilter | null;
}) {
  useEffect(() => {
    const searches = addRecentSearch(parseRecentSearches(readCookie(RECENT_SEARCHES_COOKIE)), {
      keywords,
      place,
      contract,
      at: Date.now(),
    });
    const value = encodeURIComponent(JSON.stringify(searches));
    document.cookie = `${RECENT_SEARCHES_COOKIE}=${value}; path=/; max-age=${RECENT_SEARCH_MAX_AGE_DAYS * 86_400}; samesite=lax${
      location.protocol === "https:" ? "; secure" : ""
    }`;
  }, [keywords, place, contract]);

  return null;
}
