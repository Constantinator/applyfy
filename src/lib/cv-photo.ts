// Photo facultative du CV : contrôles et calculs sans navigateur (partagés entre l'éditeur, le
// serveur et les tests). Le traitement de l'image elle-même (décodage, recadrage, réencodage en
// JPEG sans métadonnées) se fait dans le navigateur : components/cv-builder/cv-photo-panel.tsx.
//
// Vie privée : la photo reste dans le JSON du CV (data.personal.photo). Elle n'est jamais
// transmise à un modèle (chatContent, cvDataToText… la retirent) ni écrite dans les journaux.

import { PHOTO_DATA_URL, PHOTO_JPEG_PREFIX, PHOTO_MAX_LENGTH, PHOTO_REFUSED_MESSAGE } from "./cv-builder-types";

/** Longueur maximale de la data URL enregistrée (CV_LIMITS.photo), environ 290 Ko d'image. */
export { PHOTO_MAX_LENGTH };

/** Côté de la photo enregistrée, en pixels (carré, affiché rond par les modèles). */
export const PHOTO_SIZE = 400;
/** Fichier choisi : au-delà, refusé avant d'être décodé. */
export const PHOTO_FILE_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_FILE_MAX_LABEL = "15 Mo";
/** Qualités JPEG essayées dans l'ordre, jusqu'à passer sous PHOTO_MAX_LENGTH. */
export const PHOTO_QUALITIES = [0.9, 0.85, 0.8, 0.7, 0.6, 0.5] as const;
/** Zoom du recadrage : 1 = la photo couvre tout juste le cercle. */
export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 4;

export const PHOTO_MESSAGES = {
  format: "Ce format n'est pas accepté. Choisis une photo JPEG, PNG ou WebP.",
  animated: "Les images animées ne sont pas acceptées. Choisis une photo JPEG, PNG ou WebP.",
  tooBig: `Cette photo dépasse ${PHOTO_FILE_MAX_LABEL}. Choisis un fichier plus léger.`,
  unreadable: "Cette photo n'a pas pu être lue. Essaie avec un autre fichier JPEG, PNG ou WebP.",
  tooHeavy: "Cette photo reste trop lourde après compression. Essaie avec une autre photo.",
  refused: PHOTO_REFUSED_MESSAGE,
} as const;

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "svg" | "heic" | "avif" | "bmp" | "tiff" | "unknown";

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/** Type réel d'un fichier, lu dans ses premiers octets (jamais l'extension ni le type annoncé). */
export function sniffImage(bytes: Uint8Array): ImageKind {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return "gif";
  if (bytes.length >= 2 && ascii(bytes, 0, 2) === "BM") return "bmp";
  if (bytes.length >= 4 && (ascii(bytes, 0, 4) === "II*\0" || ascii(bytes, 0, 4) === "MM\0*")) return "tiff";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (/^(avif|avis)$/.test(brand)) return "avif";
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return "unknown";
}

/** PNG animé (APNG : bloc acTL avant les données) ou WebP animé (indicateur VP8X ou bloc ANIM). */
export function isAnimatedImage(bytes: Uint8Array, kind: ImageKind): boolean {
  if (kind === "png") {
    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
      const type = ascii(bytes, at + 4, 4);
      if (type === "acTL") return true;
      if (type === "IDAT" || type === "IEND") return false;
      at += 12 + length;
    }
    return false;
  }
  if (kind === "webp") {
    if (ascii(bytes, 12, 4) === "VP8X" && bytes.length > 20 && (bytes[20] & 0x02) !== 0) return true;
    for (let at = 12; at + 8 <= bytes.length; ) {
      const type = ascii(bytes, at, 4);
      if (type === "ANIM" || type === "ANMF") return true;
      const length = (bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24)) >>> 0;
      at += 8 + length + (length % 2);
    }
  }
  return false;
}

/**
 * Fichier choisi par le candidat : message de refus, ou null s'il peut être décodé. `head` : les
 * premiers octets du fichier (64 Ko suffisent pour repérer une animation).
 */
export function photoFileProblem(head: Uint8Array, size: number): string | null {
  const kind = sniffImage(head);
  if (kind !== "jpeg" && kind !== "png" && kind !== "webp") return PHOTO_MESSAGES.format;
  if (size > PHOTO_FILE_MAX_BYTES) return PHOTO_MESSAGES.tooBig;
  if (isAnimatedImage(head, kind)) return PHOTO_MESSAGES.animated;
  return null;
}

// ---------------------------------------------------------------------------
// Recadrage : un carré de PHOTO_SIZE px, la photo couvrant toujours tout le cadre
// ---------------------------------------------------------------------------

/** Zoom et position du centre de la photo par rapport au centre du cadre, en pixels de sortie. */
export type Crop = { zoom: number; x: number; y: number };
export const INITIAL_CROP: Crop = { zoom: 1, x: 0, y: 0 };

/** Échelle source → sortie pour un zoom donné (zoom 1 : le petit côté remplit le cadre). */
export const cropScale = (width: number, height: number, zoom: number) => (PHOTO_SIZE / Math.min(width, height)) * zoom;

/** Zoom borné et déplacement limité pour que la photo couvre toujours tout le cadre. */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const zoom = Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, Number.isFinite(crop.zoom) ? crop.zoom : 1));
  const scale = cropScale(width, height, zoom);
  const maxX = Math.max(0, (width * scale - PHOTO_SIZE) / 2);
  const maxY = Math.max(0, (height * scale - PHOTO_SIZE) / 2);
  const bound = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(-max, v)) : 0) || 0;
  return { zoom, x: bound(crop.x, maxX), y: bound(crop.y, maxY) };
}

/** Partie de la photo d'origine dessinée dans le carré de sortie (drawImage). */
export function cropSourceRect(crop: Crop, width: number, height: number) {
  const { zoom, x, y } = clampCrop(crop, width, height);
  const scale = cropScale(width, height, zoom);
  const side = PHOTO_SIZE / scale;
  return { sx: width / 2 - x / scale - side / 2, sy: height / 2 - y / scale - side / 2, sw: side, sh: side };
}

/** Zoom autour du centre du cadre : le point au centre reste au centre. */
export function zoomCrop(crop: Crop, zoom: number, width: number, height: number): Crop {
  const ratio = Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, zoom)) / crop.zoom;
  return clampCrop({ zoom: crop.zoom * ratio, x: crop.x * ratio, y: crop.y * ratio }, width, height);
}

/** Pas du clavier : 10 px (40 avec Maj), zoom de 0,1 (0,5 avec Maj). */
export function keyboardCrop(crop: Crop, key: string, shift: boolean, width: number, height: number): Crop | null {
  const step = shift ? 40 : 10;
  const zoomStep = shift ? 0.5 : 0.1;
  // Comme le glisser : flèche à droite, la photo se déplace vers la droite dans le cercle.
  switch (key) {
    case "ArrowLeft":
      return clampCrop({ ...crop, x: crop.x - step }, width, height);
    case "ArrowRight":
      return clampCrop({ ...crop, x: crop.x + step }, width, height);
    case "ArrowUp":
      return clampCrop({ ...crop, y: crop.y - step }, width, height);
    case "ArrowDown":
      return clampCrop({ ...crop, y: crop.y + step }, width, height);
    case "+":
    case "=":
      return zoomCrop(crop, crop.zoom + zoomStep, width, height);
    case "-":
    case "_":
      return zoomCrop(crop, crop.zoom - zoomStep, width, height);
    case "0":
    case "Home":
      return INITIAL_CROP;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Encodage et contrôle du résultat
// ---------------------------------------------------------------------------

/** Longueur de la data URL JPEG d'un fichier de `bytes` octets. */
export const jpegDataUrlLength = (bytes: number) => "data:image/jpeg;base64,".length + Math.ceil(bytes / 3) * 4;

/**
 * Encodage en JPEG à la première qualité qui passe sous la limite (`encode` : canvas.toBlob dans
 * le navigateur). Null si même la plus basse est trop lourde.
 */
export async function encodeUnderLimit<T extends { size: number }>(encode: (quality: number) => Promise<T | null>): Promise<{ blob: T; quality: number } | null> {
  for (const quality of PHOTO_QUALITIES) {
    const blob = await encode(quality);
    if (blob && jpegDataUrlLength(blob.size) <= PHOTO_MAX_LENGTH) return { blob, quality };
  }
  return null;
}

/**
 * Segments de métadonnées d'un JPEG (APP1 à APP15 : EXIF, GPS, XMP, ICC… ; COM : commentaire).
 * L'en-tête APP0 (JFIF) n'est pas une métadonnée personnelle.
 */
export function jpegMetadataSegments(bytes: Uint8Array): string[] {
  const found: string[] = [];
  if (sniffImage(bytes) !== "jpeg") return found;
  for (let at = 2; at + 4 <= bytes.length; ) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];
    if (marker === 0xda || marker === 0xd9) break; // début des données de l'image
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (marker >= 0xe1 && marker <= 0xef) found.push(marker === 0xe1 && ascii(bytes, at + 4, 4) === "Exif" ? "EXIF" : `APP${marker - 0xe0}`);
    if (marker === 0xfe) found.push("COM");
    at += 2 + length;
  }
  return found;
}

// ---------------------------------------------------------------------------
// Enregistrement : la photo n'est envoyée que si elle a changé
// ---------------------------------------------------------------------------

/** Photo envoyée par la sauvegarde automatique : la data URL, null (retirée), ou « inchangée ». */
export type PhotoPatch = string | null | "unchanged";
export const PHOTO_UNCHANGED = "unchanged";

/**
 * Suivi côté éditeur de la dernière photo dont l'enregistrement est confirmé. Tant qu'une photo
 * n'est pas confirmée, chaque sauvegarde la renvoie : deux sauvegardes qui se chevauchent ne la
 * perdent jamais. `confirm` n'est appelé que pour la réponse de la sauvegarde la plus récente.
 */
export function photoSaveTracker(initial: string | null) {
  let confirmed: string | null = initial;
  return {
    /** Ce que la sauvegarde envoie pour la photo affichée. */
    patch(current: string | null): PhotoPatch {
      return current === confirmed ? PHOTO_UNCHANGED : current;
    },
    /** Sauvegarde réussie : la photo envoyée, ou celle renvoyée par le serveur s'il l'a retirée. */
    confirm(sent: PhotoPatch, saved: string | null) {
      if (sent !== PHOTO_UNCHANGED) confirmed = saved;
      else if (saved === null) confirmed = null;
    },
    get confirmed() {
      return confirmed;
    },
  };
}

const isPhotoDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.length <= PHOTO_MAX_LENGTH && PHOTO_DATA_URL.test(value);

/**
 * Photo à enregistrer, décidée par le serveur. « unchanged » : la photo relue en base (null s'il
 * n'y en a pas, ou si elle est invalide). Nouvelle photo : JPEG seulement ; un PNG n'est gardé que
 * s'il est déjà la photo enregistrée (CV d'avant ce lot) ; WebP et le reste sont refusés.
 */
export function savedPhoto(incoming: unknown, stored: unknown): { photo: string | null; refused: boolean } {
  const existing = isPhotoDataUrl(stored) ? stored : null;
  if (incoming === PHOTO_UNCHANGED) return { photo: existing, refused: false };
  if (incoming === null || incoming === undefined || incoming === "") return { photo: null, refused: false };
  if (!isPhotoDataUrl(incoming)) return { photo: null, refused: true };
  if (incoming.startsWith(PHOTO_JPEG_PREFIX)) return { photo: incoming, refused: false };
  return incoming === existing ? { photo: incoming, refused: false } : { photo: null, refused: true };
}
