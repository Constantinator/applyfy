import "server-only";

import { CV_MAX_BYTES, CV_MAX_LABEL } from "./cv-types";

/** Valide un CV envoyé via un formulaire : présent, taille, vraie signature PDF. */
export async function readPdfUpload(
  value: FormDataEntryValue | null,
): Promise<{ ok: true; bytes: Buffer; fileName: string } | { ok: false; error: string }> {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, error: "Choisis ton CV au format PDF." };
  }
  if (value.size > CV_MAX_BYTES) {
    return { ok: false, error: `Ton CV dépasse ${CV_MAX_LABEL}. Exporte-le en PDF plus léger.` };
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  // Vérifie la signature du fichier, pas seulement son extension.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, error: "Ce fichier n'est pas un PDF valide." };
  }
  const fileName = (value.name || "cv.pdf").replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120);
  return { ok: true, bytes, fileName };
}
