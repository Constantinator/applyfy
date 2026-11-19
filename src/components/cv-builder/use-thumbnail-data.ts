"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CvData, CvLang } from "@/lib/cv-builder-types";
import { createThumbnailScheduler, thumbnailData, thumbnailKey } from "@/lib/cv-thumbnail";

/**
 * Données des vignettes du sélecteur : le CV réduit à la page 1 (cf. thumbnailData). Elles ne changent
 * que 400 ms après la dernière modification, et seulement si ce qui est dessiné change : les vignettes,
 * mémoïsées, ne se re-rendent pas pendant la frappe ni pour une modification hors de la page 1.
 */
export function useThumbnailData(data: CvData, language: CvLang) {
  const latest = useMemo(() => {
    const reduced = thumbnailData(data);
    return { data: reduced, key: thumbnailKey(reduced, language) };
  }, [data, language]);
  const [shown, setShown] = useState(latest.data);
  const scheduler = useRef<ReturnType<typeof createThumbnailScheduler<CvData>> | null>(null);
  // Un seul planificateur par sélecteur monté, créé avec la clé affichée au montage.
  const initialKey = useRef(latest.key);

  useEffect(() => {
    const current = createThumbnailScheduler<CvData>(initialKey.current, setShown);
    scheduler.current = current;
    return () => current.dispose();
  }, []);

  useEffect(() => {
    scheduler.current?.push(latest.key, latest.data);
  }, [latest]);

  return shown;
}
