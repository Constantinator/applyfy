// Mise en forme des descriptions d'offres importées, sans modifier leur contenu.
// Convention de texte (lisible telle quelle dans un champ texte) :
//   "## Titre"       → titre de section
//   "• élément"      → puce
//   ligne vide       → séparation de paragraphes

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è",
  agrave: "à", ccedil: "ç", ecirc: "ê", ocirc: "ô", ucirc: "û", icirc: "î", rsquo: "’",
  lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–", mdash: "—", bull: "•",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const HEADING_MAX_LENGTH = 80;
/** Puces converties en « • ». Les listes numérotées sont laissées telles quelles (numéros = contenu). */
const BULLET_PREFIX = /^\s*[-*•·●▪◦‣–]\s+/;
const BULLET_ONLY = /^[-*•·●▪◦‣–]$/;

/** Texte d'un fragment HTML en ligne (balises retirées, espaces normalisés). */
function inlineText(html: string) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convertit une description (HTML ou texte brut) en texte structuré :
 * titres, paragraphes et puces. Le contenu (les mots) n'est jamais modifié.
 */
export function formatOfferDescription(input: string): string {
  if (!input.trim()) return "";
  // Séquences « \n » littérales laissées par certains sites (double échappement).
  const source = input.replace(/\\n/g, "\n");
  const isHtml = /<\/?[a-z][^>]*>/i.test(source);
  const raw = isHtml ? htmlToMarked(source) : source.replace(/\r\n?/g, "\n");
  return normalizeLines(promoteHeadings(normalizeLines(raw)));
}

/**
 * Détecte les titres implicites : ligne courte, sans ponctuation finale (hors « : »),
 * en début de bloc et immédiatement suivie d'une liste à puces
 * (ex. « What We Value », « Missions », « Profil : »).
 */
function promoteHeadings(text: string) {
  const lines = text.split("\n");
  return lines
    .map((line, i) => {
      if (!line || line.startsWith("## ") || line.startsWith("• ")) return line;
      const startsBlock = i === 0 || lines[i - 1] === "";
      const next = lines[i + 1] === "" ? lines[i + 2] : lines[i + 1];
      const short = line.length <= 60 && !/[.!?;,]$/.test(line);
      return startsBlock && short && next?.startsWith("• ") ? `## ${line.replace(/\s*:$/, "")}` : line;
    })
    .join("\n");
}

function htmlToMarked(html: string) {
  const heading = (text: string) => {
    const clean = inlineText(text).replace(/\s*:$/, "");
    return clean ? `\n\n## ${clean}\n\n` : "\n\n";
  };

  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Titres explicites
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner: string) => heading(inner))
      // Bloc qui ne contient qu'un texte en gras court → titre ("<p><strong>Profil</strong></p>")
      .replace(
        /<(p|div)[^>]*>\s*<(strong|b)[^>]*>([\s\S]*?)<\/\2>\s*:?\s*(?:<br\s*\/?>\s*)*<\/\1>/gi,
        (match, _block, _bold, inner: string) =>
          inlineText(inner).length <= HEADING_MAX_LENGTH ? heading(inner) : match,
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?(ul|ol)[^>]*>/gi, "\n\n")
      .replace(/<\/(p|div|section|article|header|footer|table|tr|blockquote)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  );
}

/** Nettoie les lignes : espaces, puces uniformes, une seule ligne vide entre blocs. */
function normalizeLines(text: string) {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    let line = rawLine.replace(/[ \t\f\v ]+/g, " ").trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (BULLET_ONLY.test(line)) continue; // puce vide
    if (!line.startsWith("## ") && BULLET_PREFIX.test(line)) {
      line = `• ${line.replace(BULLET_PREFIX, "")}`;
    }
    const prev = out[out.length - 1];
    // Ligne vide avant un titre ; pas de ligne vide entre deux puces consécutives.
    if (line.startsWith("## ") && prev !== undefined && prev !== "") out.push("");
    if (line.startsWith("• ") && prev === "" && out[out.length - 2]?.startsWith("• ")) out.pop();
    out.push(line);
    if (line.startsWith("## ")) out.push("");
  }
  while (out[out.length - 1] === "") out.pop();
  // Supprime les doublons de lignes vides créés autour des titres.
  return out.filter((line, i) => !(line === "" && out[i - 1] === "")).join("\n");
}

// ---------------------------------------------------------------------------
// Lecture de la convention pour l'affichage
// ---------------------------------------------------------------------------

export type TextBlock =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

export function parseFormattedText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("• ")) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "list") last.items.push(line.slice(2));
      else blocks.push({ type: "list", items: [line.slice(2)] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
