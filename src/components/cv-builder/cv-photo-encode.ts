// Traitement de la photo du CV dans le navigateur : décodage avec l'orientation EXIF appliquée,
// recadrage en carré de 400 px, réencodage en JPEG sous la limite. Le canvas n'écrit aucune
// métadonnée : EXIF, position GPS, XMP et commentaires disparaissent (vérifié avant l'envoi).
// Sans React : utilisé par le bloc photo (cv-photo-panel.tsx) et par l'essai dans Chrome.

import { PHOTO_MESSAGES, PHOTO_SIZE, cropSourceRect, encodeUnderLimit, jpegDataUrl, jpegMetadataSegments, stripJpegMetadata, type Crop } from "@/lib/cv-photo";

export type Source = { image: ImageBitmap | HTMLImageElement; width: number; height: number };

/** Décodage avec l'orientation EXIF appliquée (createImageBitmap ; <img> en repli, qui l'applique aussi). */
export async function decodePhoto(file: File): Promise<Source> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      // L'image décodée reste utilisable après la révocation.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

export function drawCrop(canvas: HTMLCanvasElement, source: Source, crop: Crop, side: number) {
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Fond blanc : un PNG ou un WebP transparent ne devient pas noir en JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, side, side);
  const { sx, sy, sw, sh } = cropSourceRect(crop, source.width, source.height);
  ctx.drawImage(source.image, sx, sy, sw, sh, 0, 0, side, side);
}

/** Photo finale : carré de 400 px, JPEG sous la limite, sans aucune métadonnée. */
export async function encodePhoto(source: Source, crop: Crop): Promise<string> {
  const canvas = document.createElement("canvas");
  drawCrop(canvas, source, crop, PHOTO_SIZE);
  const encoded = await encodeUnderLimit((quality) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)));
  if (!encoded) throw new Error(PHOTO_MESSAGES.tooHeavy);
  // Aucune métadonnée : le canvas n'en recopie aucune de la photo, et son profil de couleur
  // générique est retiré. Vérifié : la photo ne part pas sinon.
  const bytes = stripJpegMetadata(new Uint8Array(await encoded.blob.arrayBuffer()));
  if (!bytes || jpegMetadataSegments(bytes).length) throw new Error(PHOTO_MESSAGES.unreadable);
  return jpegDataUrl(bytes);
}
