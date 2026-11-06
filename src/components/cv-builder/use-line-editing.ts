"use client";

import { useLayoutEffect, useRef } from "react";

import {
  fieldLimit,
  lineLimitMessage,
  lineMergeMessage,
  mergeLine,
  newItemId,
  splitLine,
  type CvData,
} from "@/lib/cv-builder-types";
import { splitRich } from "@/lib/cv-rich-text";

// Entrée et Retour arrière dans une ligne de liste : la même logique pour l'aperçu modifiable et
// pour l'onglet Contenu, qui ne diffèrent que par la façon de poser le curseur.

/**
 * Parties d'une ligne coupée au curseur : marquage (**gras**…) refermé et rouvert, sans jamais
 * dépasser la limite du champ, blancs retirés à la coupure.
 */
export function cutLine(path: string, before: string, after: string): [string, string] {
  const [head, tail] = splitRich(before, after);
  const limit = fieldLimit(path);
  const [a, b] = head.length > limit || tail.length > limit ? [before, after] : [head, tail];
  return [a.trimEnd(), b.trimStart()];
}

export function useLineEditing({
  data,
  apply,
  notify,
  focus,
  onActivate,
}: {
  data: CvData;
  /** Mise à jour du CV par l'éditeur (peut être rejouée par React : même résultat). */
  apply: (fn: (d: CvData) => CvData) => void;
  /** Saisie bloquée : message à montrer. */
  notify: (message: string) => void;
  /** Pose le curseur dans ce champ, une fois le CV à jour à l'écran. */
  focus: (path: string, offset: number) => void;
  /** Ligne qui va recevoir le curseur (à garder à l'écran, même vide). */
  onActivate?: (path: string) => void;
}) {
  const pending = useRef<{ path: string; offset: number } | null>(null);
  const focusRef = useRef(focus);
  useLayoutEffect(() => {
    focusRef.current = focus;
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    focusRef.current(target.path, target.offset);
  });

  const breakLine = (path: string, before: string, after: string) => {
    const newId = newItemId();
    const split = splitLine(data, path, before, after, newId);
    // Liste pleine : rien ne change, le curseur reste en place.
    if (!split) {
      notify(lineLimitMessage(path));
      return;
    }
    pending.current = { path: split.nextPath, offset: 0 };
    onActivate?.(split.nextPath);
    apply((d) => splitLine(d, path, before, after, newId)?.data ?? d);
  };

  /** true si le Retour arrière a été pris en charge (le navigateur ne doit rien faire de plus). */
  const mergeWithPrevious = (path: string) => {
    const merged = mergeLine(data, path);
    if (!merged) return false;
    if (!("data" in merged)) {
      notify(lineMergeMessage(merged));
      return true;
    }
    pending.current = { path: merged.targetPath, offset: merged.offset };
    onActivate?.(merged.targetPath);
    apply((d) => {
      const next = mergeLine(d, path);
      return next && "data" in next ? next.data : d;
    });
    return true;
  };

  return { breakLine, mergeWithPrevious };
}
