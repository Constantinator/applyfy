// CV amélioré : conversion du CV structuré (généré par Claude) en HTML, et nettoyage
// du HTML modifié par l'utilisateur avant enregistrement et affichage.

/** Poste, diplôme… : intitulé et dates sur la même ligne, structure et lieu en dessous. */
export type CvEntry = {
  intitule: string;
  structure: string;
  lieu: string;
  periode: string;
  puces: string[];
};

/** CV au format épuré « à l'américaine » : sections fixes, dans cet ordre. */
export type ImprovedCv = {
  langue: "fr" | "en";
  nom: string;
  coordonnees: { ville: string; email: string; telephone: string; linkedin: string };
  formation: CvEntry[];
  experience: CvEntry[];
  competences: { categorie: string; elements: string }[];
  interets: string;
};

const SECTION_TITLES = {
  fr: { formation: "Formation", experience: "Expérience", competences: "Compétences", interets: "Intérêts" },
  en: { formation: "Education", experience: "Experience", competences: "Skills", interets: "Interests" },
} as const;

/** Délimiteurs utilisés par Claude pour marquer un passage amélioré (ajouté ou reformulé). */
export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";

export const CV_HTML_MAX_LENGTH = 100_000;

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texte → HTML échappé, passages ⟦…⟧ surlignés avec <mark>. */
export function inline(text: string) {
  return escapeHtml(text.trim())
    .replace(/⟦([\s\S]*?)⟧/g, "<mark>$1</mark>")
    .replace(/[⟦⟧]/g, ""); // délimiteur orphelin
}

/**
 * Structure HTML (sans attributs, compatible avec sanitizeCvHtml), mise en forme par
 * l'éditeur :
 *   <h1>Nom</h1> <p>Ville | email | téléphone | LinkedIn</p>
 *   <h2>Section</h2>
 *   <h3><span>Intitulé</span><span>Dates</span></h3> <p><em>Structure, lieu</em></p> <ul>…</ul>
 *   <p><strong>Catégorie :</strong> compétences</p>
 */
export function improvedCvToHtml(cv: ImprovedCv): string {
  const titles = SECTION_TITLES[cv.langue] ?? SECTION_TITLES.fr;
  const parts: string[] = [`<h1>${inline(cv.nom)}</h1>`];

  const { ville, email, telephone, linkedin } = cv.coordonnees;
  const contact = [ville, email, telephone, linkedin].filter((s) => s.trim()).map(inline).join(" | ");
  if (contact) parts.push(`<p>${contact}</p>`);

  const entries = (title: string, list: CvEntry[]) => {
    const kept = list.filter((e) => e.intitule.trim() || e.structure.trim());
    if (!kept.length) return;
    parts.push(`<h2>${title}</h2>`);
    for (const entry of kept) {
      const date = entry.periode.trim() ? `<span>${inline(entry.periode)}</span>` : "";
      parts.push(`<h3><span>${inline(entry.intitule || entry.structure)}</span>${date}</h3>`);
      const where = [entry.intitule.trim() ? entry.structure : "", entry.lieu]
        .filter((s) => s.trim())
        .map(inline)
        .join(", ");
      if (where) parts.push(`<p><em>${where}</em></p>`);
      const bullets = entry.puces.filter((p) => p.trim());
      if (bullets.length) parts.push(`<ul>${bullets.map((p) => `<li>${inline(p)}</li>`).join("")}</ul>`);
    }
  };
  entries(titles.formation, cv.formation);
  entries(titles.experience, cv.experience);

  const skills = cv.competences.filter((c) => c.elements.trim());
  if (skills.length) {
    parts.push(`<h2>${titles.competences}</h2>`);
    for (const { categorie, elements } of skills) {
      parts.push(
        categorie.trim()
          ? `<p><strong>${inline(categorie)}${cv.langue === "en" ? ":" : " :"}</strong> ${inline(elements)}</p>`
          : `<p>${inline(elements)}</p>`,
      );
    }
  }
  if (cv.interets.trim()) parts.push(`<h2>${titles.interets}</h2>`, `<p>${inline(cv.interets)}</p>`);

  return parts.join("\n");
}

/**
 * Nettoie du HTML (issu de l'éditeur) : seules des balises de mise en forme sont
 * conservées, SANS aucun attribut (pas de style, onclick, href, src…), sauf le type
 * de liste d'un <ul> limité à des valeurs connues. Tout autre « < » ou « > » est
 * échappé. Le résultat peut être affiché en toute sécurité.
 */
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "b", "em", "i", "u", "mark", "br", "div", "span",
]);
const VOID_TAGS = new Set(["br"]);

/** Styles de liste à puces personnalisés (attribut data-list d'un <ul>). */
export const CV_LIST_STYLES = ["tirets", "coches"] as const;
export type CvListStyle = (typeof CV_LIST_STYLES)[number];
const LIST_STYLE_ATTRIBUTE = new RegExp(`\\sdata-list\\s*=\\s*"(${CV_LIST_STYLES.join("|")})"`);

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
    else if (closing) out += `</${tag}>`;
    else {
      const listStyle = tag === "ul" ? match[0].match(LIST_STYLE_ATTRIBUTE)?.[1] : undefined;
      out += listStyle ? `<ul data-list="${listStyle}">` : `<${tag}>`;
    }
  }
  out += escapeText(html.slice(last));
  return out;
}

/** Texte du premier <h1> (le nom du candidat), pour nommer le fichier PDF. */
export function firstHeadingText(html: string) {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() : "";
}

/** Texte hors balises : « < » et « > » échappés, entités existantes conservées. */
function escapeText(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
