import "server-only";

import { inflateRawSync } from "node:zlib";

// Texte d'un document Word (.docx) : une archive ZIP dont le contenu principal est
// word/document.xml. Lecteur minimal, sans dépendance : répertoire central de l'archive,
// puis décompression (méthode « deflate » ou sans compression) de ce seul fichier.

/** Taille maximale du XML décompressé (protection contre les archives piégées). */
const MAX_XML_BYTES = 10 * 1024 * 1024;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML WordprocessingML → texte : un paragraphe par ligne. */
function documentXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (match, name: string) =>
      name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? match),
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texte d'un .docx, ou null si le fichier n'est pas un document Word lisible. */
export function extractDocxText(buffer: Buffer): string | null {
  try {
    // Fin du répertoire central : signature 0x06054b50, dans les derniers 64 Ko.
    let end = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;

    const entries = buffer.readUInt16LE(end + 10);
    let offset = buffer.readUInt32LE(end + 16);
    for (let n = 0; n < entries; n++) {
      if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;
      const method = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const localHeader = buffer.readUInt32LE(offset + 42);
      const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

      if (name === "word/document.xml") {
        if (buffer.readUInt32LE(localHeader) !== 0x04034b50) return null;
        const start = localHeader + 30 + buffer.readUInt16LE(localHeader + 26) + buffer.readUInt16LE(localHeader + 28);
        const data = buffer.subarray(start, start + compressedSize);
        const xml =
          method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES }) : null;
        if (!xml) return null;
        const text = documentXmlToText(xml.toString("utf8"));
        return text || null;
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return null;
  } catch {
    return null; // archive tronquée, compression inconnue, taille dépassée…
  }
}
