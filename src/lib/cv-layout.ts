// Passage du CV en une / deux colonnes, par manipulation du DOM de l'éditeur (client).
// Structure en deux colonnes (HTML sans attributs, compatible avec sanitizeCvHtml) :
//   <h1>, <p>… (en-tête, pleine largeur)
//   <div> sections de la colonne gauche (compétences, langues…) </div>
//   <div> sections de la colonne droite (profil, expériences, formation…) </div>
import { SIDE_COLUMN_SECTION, type CvLayout } from "./cv-style";

/**
 * Div de colonne : enfant direct de l'éditeur contenant un titre de section, ou
 * colonne restée vide (ex. aucune section « compétences »). Les lignes <div> créées
 * par la touche Entrée dans l'éditeur contiennent au moins un <br> : jamais confondues.
 */
function isColumn(el: Element) {
  return el.tagName === "DIV" && (el.querySelector(":scope > h2") !== null || el.childNodes.length === 0);
}

/** Remet le CV à plat (une colonne) : contenu principal d'abord, puis la colonne latérale. */
export function toOneColumn(root: HTMLElement) {
  const columns = [...root.children].filter(isColumn);
  if (columns.length === 0) return;
  // Ordre de lecture en une colonne : colonne principale (droite), puis latérale (gauche).
  const ordered = columns.length === 2 ? [columns[1], columns[0]] : columns;
  const anchor = columns[0];
  for (const column of ordered) {
    while (column.firstChild) root.insertBefore(column.firstChild, anchor);
  }
  columns.forEach((c) => c.remove());
}

/** Regroupe les sections (chaque <h2> et ce qui le suit) en deux colonnes. */
export function toTwoColumns(root: HTMLElement) {
  toOneColumn(root);
  const firstSection = [...root.children].find((el) => el.tagName === "H2");
  if (!firstSection) return; // pas de sections : rien à répartir

  const side = document.createElement("div");
  const main = document.createElement("div");
  let current: HTMLElement | null = null;
  let node: ChildNode | null = firstSection;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    if (node instanceof HTMLElement && node.tagName === "H2") {
      current = SIDE_COLUMN_SECTION.test(node.textContent ?? "") ? side : main;
    }
    current?.appendChild(node);
    node = next;
  }
  root.append(side, main);
}

export function applyLayout(root: HTMLElement, layout: CvLayout) {
  if (layout === "deux_colonnes") toTwoColumns(root);
  else toOneColumn(root);
}
