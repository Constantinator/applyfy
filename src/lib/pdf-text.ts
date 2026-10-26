import "server-only";

/**
 * Texte d'un PDF (pdfjs-dist), pour les PDF que Claude refuse de lire comme document : le
 * contenu est alors transmis en texte brut. Chaîne vide si le PDF n'a pas de texte (scan).
 */
export async function extractPdfText(bytes: Buffer, maxPages = 10): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
          .join("")
          .trim(),
      );
    }
    return pages.filter(Boolean).join("\n\n");
  } finally {
    await pdf.destroy();
  }
}
