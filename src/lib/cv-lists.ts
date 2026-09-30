// Types de liste de l'éditeur de CV. Puces et numéros : listes HTML natives (<ul>, <ol>).
// Tirets et coches : <ul data-list="…">, stylés dans globals.css et conservés par
// sanitizeCvHtml (lib/cv-html).

import type { CvListStyle } from "./cv-html";

export const CV_LIST_TYPES = {
  puces: "• Liste à puces",
  numerotee: "1. Liste numérotée",
  tirets: "— Liste avec tirets",
  coches: "✓ Liste avec coches",
} as const;

export type CvListType = keyof typeof CV_LIST_TYPES;

/** Type de la liste qui contient la sélection, ou null hors liste. */
export type CvListState = CvListType | null;

const CUSTOM_STYLES: Record<CvListType, CvListStyle | null> = {
  puces: null,
  numerotee: null,
  tirets: "tirets",
  coches: "coches",
};

/** Liste (<ul> ou <ol>) la plus proche contenant le nœud, dans l'éditeur uniquement. */
export function closestList(node: Node | null, root: HTMLElement): HTMLElement | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const list = element?.closest<HTMLElement>("ul, ol");
  return list && list !== root && root.contains(list) ? list : null;
}

export function listTypeOf(list: HTMLElement): CvListType {
  if (list.tagName === "OL") return "numerotee";
  const style = list.getAttribute("data-list");
  return style === "tirets" || style === "coches" ? style : "puces";
}

/** Listes touchées par la sélection (celle qui contient le curseur, ou toutes celles sélectionnées). */
function listsInRange(root: HTMLElement, range: Range): HTMLElement[] {
  const lists = [...root.querySelectorAll<HTMLElement>("ul, ol")].filter((list) => range.intersectsNode(list));
  // Seulement les listes les plus internes (une sous-liste garde son propre type).
  return lists.filter((list) => !lists.some((other) => other !== list && list.contains(other)));
}

/**
 * Applique un type de liste au texte sélectionné dans l'éditeur (ou retire la liste
 * avec null). La création et le passage puces ↔ numéros passent par execCommand pour
 * conserver l'annulation (Ctrl+Z) et la sélection. Retourne false si la sélection
 * n'est pas dans l'éditeur.
 */
export function applyListType(root: HTMLElement, type: CvListState): boolean {
  const selection = document.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;

  const current = closestList(range.startContainer, root);

  if (type === null) {
    // Même commande que la liste actuelle = bascule « sans liste ».
    if (current) document.execCommand(current.tagName === "OL" ? "insertOrderedList" : "insertUnorderedList");
    return true;
  }

  const tag = type === "numerotee" ? "OL" : "UL";
  if (current?.tagName !== tag) {
    document.execCommand(tag === "OL" ? "insertOrderedList" : "insertUnorderedList");
  }

  if (tag === "UL" && selection.rangeCount) {
    const style = CUSTOM_STYLES[type];
    for (const list of listsInRange(root, selection.getRangeAt(0))) {
      if (list.tagName !== "UL") continue;
      if (style) list.setAttribute("data-list", style);
      else list.removeAttribute("data-list");
    }
  }
  return true;
}
