// CV amélioré : conversion du CV structuré (généré par Claude) en HTML, et nettoyage
// du HTML modifié par l'utilisateur avant enregistrement et affichage.

export type ImprovedCv = {
  nom: string;
  titre: string;
  coordonnees: string;
  accroche: string;
  sections: {
    titre: string;
    entrees: { intitule: string; sous_titre: string; periode: string; puces: string[] }[];
  }[];
};

/** Délimiteurs utilisés par Claude pour marquer un passage amélioré (ajouté ou reformulé). */
export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";

export const CV_HTML_MAX_LENGTH = 100_000;

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texte → HTML échappé, passages ⟦…⟧ surlignés avec <mark>. */
function inline(text: string) {
  return escapeHtml(text.trim())
    .replace(/⟦([\s\S]*?)⟧/g, "<mark>$1</mark>")
    .replace(/[⟦⟧]/g, ""); // délimiteur orphelin
}

export function improvedCvToHtml(cv: ImprovedCv): string {
  const parts: string[] = [`<h1>${inline(cv.nom)}</h1>`];
  if (cv.titre.trim()) parts.push(`<p><strong>${inline(cv.titre)}</strong></p>`);
  if (cv.coordonnees.trim()) parts.push(`<p>${inline(cv.coordonnees)}</p>`);
  if (cv.accroche.trim()) parts.push(`<h2>Profil</h2>`, `<p>${inline(cv.accroche)}</p>`);

  for (const section of cv.sections) {
    parts.push(`<h2>${inline(section.titre)}</h2>`);
    for (const entry of section.entrees) {
      if (entry.intitule.trim()) parts.push(`<h3>${inline(entry.intitule)}</h3>`);
      const meta = [entry.sous_titre, entry.periode].filter((s) => s.trim()).map(inline).join(" · ");
      if (meta) parts.push(`<p><em>${meta}</em></p>`);
      const bullets = entry.puces.filter((p) => p.trim());
      if (bullets.length) parts.push(`<ul>${bullets.map((p) => `<li>${inline(p)}</li>`).join("")}</ul>`);
    }
  }
  return parts.join("\n");
}

/**
 * Nettoie du HTML (issu de l'éditeur) : seules des balises de mise en forme sont
 * conservées, SANS aucun attribut (pas de style, onclick, href, src…). Tout autre
 * « < » ou « > » est échappé. Le résultat peut être affiché en toute sécurité.
 */
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "b", "em", "i", "u", "mark", "br", "div", "span",
]);
const VOID_TAGS = new Set(["br"]);

export function sanitizeCvHtml(html: string): string {
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;
  let out = "";
  let last = 0;
  for (const match of html.matchAll(tagPattern)) {
    out += escapeText(html.slice(last, match.index));
    last = match.index + match[0].length;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue; // balise supprimée (son texte est conservé)
    if (VOID_TAGS.has(tag)) out += closing ? "" : `<${tag}>`;
    else out += closing ? `</${tag}>` : `<${tag}>`;
  }
  out += escapeText(html.slice(last));
  return out;
}

/** Texte hors balises : « < » et « > » échappés, entités existantes conservées. */
function escapeText(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
