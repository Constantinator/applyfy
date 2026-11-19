// Photo facultative du CV (lot photo) : type du fichier lu dans ses octets, refus des formats
// non acceptés et des images animées, recadrage qui couvre toujours le cercle, clavier, choix de
// la qualité, métadonnées, et photo envoyée seulement si elle a changé (sauvegardes qui se
// chevauchent comprises). Lancé par `npm test` (Node 22.18 ou plus).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts")) {
      const file = fileURLToPath(new URL(`${spec}.ts`, ctx.parentURL));
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const {
  INITIAL_CROP,
  PHOTO_MAX_LENGTH,
  PHOTO_MESSAGES,
  PHOTO_QUALITIES,
  PHOTO_SIZE,
  PHOTO_UNCHANGED,
  PHOTO_ZOOM_MAX,
  clampCrop,
  cropScale,
  cropSourceRect,
  encodeUnderLimit,
  isAnimatedImage,
  jpegDataUrlLength,
  jpegDataUrl,
  jpegMetadataSegments,
  keyboardCrop,
  photoFileProblem,
  photoSaveTracker,
  savedPhoto,
  sniffImage,
  stripJpegMetadata,
  zoomCrop,
} = await import("./cv-photo.ts");
const { CV_TEMPLATE_IDS, PHOTO_TEMPLATES, fitCvData, templateHasPhoto } = await import("./cv-builder-types.ts");

const bytes = (...parts) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : Array.isArray(p) ? p : [p])));
const u32be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const u16be = (n) => [(n >>> 8) & 255, n & 255];

/** JPEG minimal : SOI, segments donnés, puis SOS. */
const jpeg = (...segments) => bytes([0xff, 0xd8], ...segments, [0xff, 0xda, 0, 2], [0xff, 0xd9]);
const segment = (marker, payload) => [0xff, marker, ...u16be(payload.length + 2), ...[...payload].map((c) => (typeof c === "string" ? c.charCodeAt(0) : c))];
const JFIF = segment(0xe0, "JFIF\0\x01\x01\0\0\x01\0\x01\0\0");
const EXIF_GPS = segment(0xe1, "Exif\0\0MM\0*\0\0\0\x08GPS 48.8566 2.3522");
const XMP = segment(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>");

const pngChunk = (type, data = []) => [...u32be(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
const png = (...chunks) => bytes("\x89PNG\r\n\x1a\n", ...chunks);
const IHDR = pngChunk("IHDR", [...u32be(10), ...u32be(10), 8, 6, 0, 0, 0]);

const webpChunk = (type, data) => [...[...type].map((c) => c.charCodeAt(0)), ...u32le(data.length), ...data, ...(data.length % 2 ? [0] : [])];
const webp = (...chunks) => {
  const body = chunks.flat();
  return bytes("RIFF", u32le(body.length + 4), "WEBP", body);
};
const ftyp = (brand) => bytes(u32be(24), "ftyp", brand, [0, 0, 0, 0], "mif1", brand);

test("type du fichier lu dans ses octets : JPEG, PNG et WebP acceptés", () => {
  assert.equal(sniffImage(jpeg(JFIF)), "jpeg");
  assert.equal(sniffImage(png(IHDR)), "png");
  assert.equal(sniffImage(webp(webpChunk("VP8 ", [1, 2, 3, 4]))), "webp");
  for (const file of [jpeg(JFIF), png(IHDR), webp(webpChunk("VP8 ", [1, 2, 3, 4]))]) {
    assert.equal(photoFileProblem(file, 1_000_000), null);
  }
});

test("SVG, GIF, HEIC, AVIF, BMP, TIFF, PDF et texte : refusés avec un message clair", () => {
  const files = {
    svg: bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    svgXml: bytes('<?xml version="1.0"?>\n<svg></svg>'),
    gif: bytes("GIF89a", [1, 0, 1, 0]),
    heic: ftyp("heic"),
    avif: ftyp("avif"),
    bmp: bytes("BM", [0, 0, 0, 0]),
    tiff: bytes("II*\0", [8, 0, 0, 0]),
    pdf: bytes("%PDF-1.7\n"),
    text: bytes("Bonjour, ceci n'est pas une image."),
    empty: new Uint8Array(),
  };
  for (const [name, file] of Object.entries(files)) {
    assert.equal(photoFileProblem(file, 1000), PHOTO_MESSAGES.format, name);
  }
  assert.equal(sniffImage(files.svgXml), "svg");
  assert.equal(sniffImage(files.heic), "heic");
  assert.equal(sniffImage(files.avif), "avif");
  assert.match(PHOTO_MESSAGES.format, /JPEG, PNG ou WebP/);
});

test("un fichier .jpg qui est en réalité un SVG est refusé (l'extension ne compte pas)", () => {
  assert.equal(photoFileProblem(bytes("<svg onload='x'></svg>"), 100), PHOTO_MESSAGES.format);
});

test("images animées refusées : PNG animé (acTL) et WebP animé (VP8X ou ANIM)", () => {
  const apng = png(IHDR, pngChunk("acTL", [...u32be(2), ...u32be(0)]), pngChunk("IDAT", [0]));
  assert.equal(isAnimatedImage(apng, "png"), true);
  assert.equal(photoFileProblem(apng, 1000), PHOTO_MESSAGES.animated);
  assert.equal(isAnimatedImage(png(IHDR, pngChunk("IDAT", [0]), pngChunk("acTL", [0])), "png"), false, "acTL après les données : ignoré");

  const vp8x = (flags) => webpChunk("VP8X", [flags, 0, 0, 0, 9, 0, 0, 9, 0, 0]);
  assert.equal(photoFileProblem(webp(vp8x(0x02), webpChunk("ANIM", [0, 0, 0, 0, 0, 0])), 1000), PHOTO_MESSAGES.animated);
  assert.equal(photoFileProblem(webp(vp8x(0x00), webpChunk("ANMF", [0, 0])), 1000), PHOTO_MESSAGES.animated);
  assert.equal(photoFileProblem(webp(vp8x(0x10), webpChunk("VP8L", [1, 2, 3])), 1000), null, "WebP fixe avec transparence");
});

test("fichier trop lourd : refusé avant d'être décodé", () => {
  assert.equal(photoFileProblem(jpeg(JFIF), 16 * 1024 * 1024), PHOTO_MESSAGES.tooBig);
});

test("recadrage : la photo couvre toujours tout le cercle, quels que soient zoom et déplacement", () => {
  const sizes = [[400, 400], [3000, 3000], [4000, 1000], [600, 4000], [401, 399], [120, 90]];
  const crops = [INITIAL_CROP, { zoom: 1, x: 5000, y: -5000 }, { zoom: 9, x: -1e9, y: 1e9 }, { zoom: 0.2, x: 30, y: 30 }, { zoom: NaN, x: NaN, y: Infinity }, { zoom: 2.5, x: 120, y: -80 }];
  for (const [w, h] of sizes) {
    for (const crop of crops) {
      const c = clampCrop(crop, w, h);
      assert.ok(c.zoom >= 1 && c.zoom <= PHOTO_ZOOM_MAX, `zoom ${c.zoom}`);
      const r = cropSourceRect(crop, w, h);
      const eps = 1e-9;
      assert.ok(r.sx >= -eps && r.sy >= -eps, `${w}x${h} ${JSON.stringify(crop)} : départ ${r.sx}, ${r.sy}`);
      assert.ok(r.sx + r.sw <= w + 1e-6 && r.sy + r.sh <= h + 1e-6, `${w}x${h} ${JSON.stringify(crop)} : dépasse`);
      assert.ok(Math.abs(r.sw - r.sh) < 1e-9, "carré");
    }
  }
});

test("recadrage de départ : centré, le petit côté remplit le cercle (photo très large, très haute)", () => {
  assert.deepEqual(cropSourceRect(INITIAL_CROP, 4000, 1000), { sx: 1500, sy: 0, sw: 1000, sh: 1000 });
  assert.deepEqual(cropSourceRect(INITIAL_CROP, 1000, 4000), { sx: 0, sy: 1500, sw: 1000, sh: 1000 });
  assert.equal(cropScale(800, 800, 1), PHOTO_SIZE / 800);
});

test("zoom autour du centre du cadre et déplacement borné", () => {
  const z = zoomCrop({ zoom: 1, x: 100, y: 0 }, 2, 4000, 1000);
  assert.deepEqual(z, { zoom: 2, x: 200, y: 0 });
  // Zoom 1 sur une photo carrée : aucun déplacement possible.
  assert.deepEqual(clampCrop({ zoom: 1, x: 50, y: -50 }, 800, 800), { zoom: 1, x: 0, y: 0 });
  // Dézoom : le déplacement est ramené dans les bornes.
  assert.deepEqual(zoomCrop({ zoom: 3, x: 400, y: 0 }, 1, 800, 800), { zoom: 1, x: 0, y: 0 });
});

test("clavier : flèches (Maj : pas plus grand), + et − pour le zoom, 0 pour revenir au départ", () => {
  const w = 1200, h = 1200;
  let c = keyboardCrop(INITIAL_CROP, "+", false, w, h);
  assert.ok(Math.abs(c.zoom - 1.1) < 1e-9);
  c = keyboardCrop({ zoom: 2, x: 0, y: 0 }, "ArrowRight", false, w, h);
  assert.deepEqual(c, { zoom: 2, x: 10, y: 0 });
  c = keyboardCrop({ zoom: 2, x: 0, y: 0 }, "ArrowUp", true, w, h);
  assert.deepEqual(c, { zoom: 2, x: 0, y: -40 });
  assert.deepEqual(keyboardCrop({ zoom: 2, x: 0, y: 0 }, "ArrowLeft", false, w, h), { zoom: 2, x: -10, y: 0 });
  assert.deepEqual(keyboardCrop({ zoom: 2, x: 0, y: 0 }, "ArrowDown", false, w, h), { zoom: 2, x: 0, y: 10 });
  assert.equal(keyboardCrop({ zoom: 2, x: 0, y: 0 }, "-", true, w, h).zoom, 1.5);
  assert.deepEqual(keyboardCrop({ zoom: 3, x: 50, y: 50 }, "0", false, w, h), INITIAL_CROP);
  assert.equal(keyboardCrop(INITIAL_CROP, "a", false, w, h), null, "autre touche : laissée au navigateur (Tab, Échap)");
  // Zoom au maximum : + ne dépasse pas.
  assert.equal(keyboardCrop({ zoom: PHOTO_ZOOM_MAX, x: 0, y: 0 }, "+", true, w, h).zoom, PHOTO_ZOOM_MAX);
});

test("compression : première qualité qui passe sous la limite, sinon refus", async () => {
  const limitBytes = Math.floor(((PHOTO_MAX_LENGTH - "data:image/jpeg;base64,".length) / 4) * 3);
  assert.ok(jpegDataUrlLength(limitBytes) <= PHOTO_MAX_LENGTH);
  assert.ok(jpegDataUrlLength(limitBytes + 3) > PHOTO_MAX_LENGTH);

  const tried = [];
  const sized = (q) => ({ size: q >= 0.8 ? limitBytes + 1000 : limitBytes - 1000 });
  const result = await encodeUnderLimit(async (q) => (tried.push(q), sized(q)));
  assert.equal(result.quality, 0.7);
  assert.deepEqual(tried, [0.9, 0.85, 0.8, 0.7]);
  assert.equal(await encodeUnderLimit(async () => ({ size: limitBytes * 2 })), null);
  assert.equal(PHOTO_QUALITIES.at(-1), 0.5);
});

test("métadonnées d'un JPEG : EXIF (GPS), XMP et commentaire détectés ; JFIF seul n'en est pas", () => {
  assert.deepEqual(jpegMetadataSegments(jpeg(JFIF)), []);
  assert.deepEqual(jpegMetadataSegments(jpeg(JFIF, EXIF_GPS, XMP, segment(0xfe, "Appareil X"))), ["EXIF", "APP1", "COM"]);
  assert.deepEqual(jpegMetadataSegments(png(IHDR)), []);
});

test("nettoyage du JPEG : EXIF (GPS), XMP, profil de couleur et commentaire retirés, image recopiée telle quelle", () => {
  const ICC = segment(0xe2, "ICC_PROFILE sRGB");
  const DQT = segment(0xdb, [0, ...Array(64).fill(1)]);
  const file = jpeg(JFIF, EXIF_GPS, ICC, DQT, XMP, segment(0xfe, "Appareil X"));
  const clean = stripJpegMetadata(file);
  assert.deepEqual(jpegMetadataSegments(clean), []);
  assert.ok(!new TextDecoder("latin1").decode(clean).includes("GPS"));
  assert.deepEqual([...clean], [...jpeg(JFIF, DQT)], "SOI, JFIF, tables et données gardés dans l'ordre");
  assert.equal(stripJpegMetadata(png(IHDR)), null);
  assert.equal(stripJpegMetadata(bytes([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00])), null, "segment tronqué : refusé");
  const url = jpegDataUrl(clean);
  assert.ok(url.startsWith("data:image/jpeg;base64,/9j/"));
  assert.deepEqual([...Buffer.from(url.split(",")[1], "base64")], [...clean]);
  assert.ok(fitCvData({ personal: { photo: url } }).data.personal.photo === url);
});

// ---------------------------------------------------------------------------
// Enregistrement : serveur (savedPhoto) et éditeur (photoSaveTracker)
// ---------------------------------------------------------------------------

const JPEG_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==";
const JPEG_URL_2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2W==";
const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const WEBP_URL = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

test("serveur : « inchangée » remet la photo enregistrée, et rien s'il n'y en a pas en base", () => {
  assert.deepEqual(savedPhoto(PHOTO_UNCHANGED, JPEG_URL), { photo: JPEG_URL, refused: false });
  assert.deepEqual(savedPhoto(PHOTO_UNCHANGED, null), { photo: null, refused: false });
  assert.deepEqual(savedPhoto(PHOTO_UNCHANGED, undefined), { photo: null, refused: false }, "CV sans ligne : rien à relire");
  assert.deepEqual(savedPhoto(PHOTO_UNCHANGED, "data:image/svg+xml;base64,PHN2Zz4="), { photo: null, refused: false }, "valeur en base invalide : jamais remise");
});

test("serveur : nouvelle photo JPEG acceptée, PNG seulement s'il est déjà la photo enregistrée, WebP refusé", () => {
  assert.deepEqual(savedPhoto(JPEG_URL, null), { photo: JPEG_URL, refused: false });
  assert.deepEqual(savedPhoto(JPEG_URL_2, JPEG_URL), { photo: JPEG_URL_2, refused: false });
  assert.deepEqual(savedPhoto(PNG_URL, PNG_URL), { photo: PNG_URL, refused: false });
  assert.deepEqual(savedPhoto(PNG_URL, null), { photo: null, refused: true });
  assert.deepEqual(savedPhoto(PNG_URL, JPEG_URL), { photo: null, refused: true });
  assert.deepEqual(savedPhoto(WEBP_URL, null), { photo: null, refused: true });
  assert.deepEqual(savedPhoto("data:image/svg+xml;base64,PHN2Zz4=", null), { photo: null, refused: true });
  assert.deepEqual(savedPhoto("data:image/jpeg;base64,iVBORw0KGgo=", null), { photo: null, refused: true }, "type annoncé ≠ contenu");
  assert.deepEqual(savedPhoto(`${JPEG_URL.slice(0, -2)}${"A".repeat(PHOTO_MAX_LENGTH)}`, null), { photo: null, refused: true }, "trop lourde");
  assert.deepEqual(savedPhoto(null, JPEG_URL), { photo: null, refused: false }, "suppression");
});

test("validation du CV : WebP et type annoncé faux retirés avec un message ; JPEG et PNG existants gardés", () => {
  for (const photo of [WEBP_URL, "data:image/jpeg;base64,iVBORw0KGgo=", "data:image/gif;base64,R0lGODlh", "javascript:alert(1)"]) {
    const { data, fixes } = fitCvData({ personal: { photo } });
    assert.equal(data.personal.photo, null, photo);
    assert.ok(fixes.some((f) => f.path === "personal.photo" && !f.message.includes("data:")));
  }
  for (const photo of [JPEG_URL, PNG_URL]) assert.equal(fitCvData({ personal: { photo } }).data.personal.photo, photo);
});

test("éditeur : la photo n'est envoyée que si elle a changé depuis le dernier enregistrement confirmé", () => {
  const t = photoSaveTracker(JPEG_URL);
  assert.equal(t.patch(JPEG_URL), PHOTO_UNCHANGED);
  assert.equal(t.patch(JPEG_URL_2), JPEG_URL_2);
  t.confirm(JPEG_URL_2, JPEG_URL_2);
  assert.equal(t.patch(JPEG_URL_2), PHOTO_UNCHANGED);
  assert.equal(t.patch(null), null);
  t.confirm(null, null);
  assert.equal(t.patch(null), PHOTO_UNCHANGED);
});

/**
 * Base et serveur simulés : chaque sauvegarde lit la photo enregistrée au moment où elle est
 * traitée (savedPhoto), comme saveBuilderCvAction. Les réponses arrivent dans l'ordre donné.
 */
function simulate(initial) {
  const db = { photo: initial };
  const tracker = photoSaveTracker(initial);
  let version = 0;
  return {
    db,
    tracker,
    /** Départ d'une sauvegarde : ce que l'éditeur envoie. */
    send(current) {
      return { version: ++version, patch: tracker.patch(current) };
    },
    /** Traitement par le serveur puis réponse à l'éditeur (ignorée si une sauvegarde plus récente est partie). */
    process(request) {
      const { photo } = savedPhoto(request.patch, db.photo);
      db.photo = photo;
      return { ...request, saved: photo };
    },
    receive(response) {
      if (response.version === version) tracker.confirm(response.patch, response.saved);
    },
  };
}

test("deux sauvegardes qui se chevauchent : la nouvelle photo n'est jamais perdue", () => {
  const s = simulate(null);
  // Ajout de la photo : sauvegarde A part ; une frappe déclenche B avant la réponse de A.
  const a = s.send(JPEG_URL);
  const b = s.send(JPEG_URL);
  assert.equal(a.patch, JPEG_URL);
  assert.equal(b.patch, JPEG_URL, "non confirmée : renvoyée par B");
  // Le serveur traite B avant A, puis A : la photo reste.
  const rb = s.process(b);
  const ra = s.process(a);
  s.receive(ra); // A, plus ancienne : ignorée
  s.receive(rb);
  assert.equal(s.db.photo, JPEG_URL);
  assert.equal(s.tracker.confirmed, JPEG_URL);
  // Ensuite : plus envoyée.
  const c = s.send(JPEG_URL);
  assert.equal(c.patch, PHOTO_UNCHANGED);
  s.receive(s.process(c));
  assert.equal(s.db.photo, JPEG_URL);
});

test("deux sauvegardes qui se chevauchent : une suppression n'est jamais annulée par une sauvegarde « inchangée »", () => {
  const s = simulate(JPEG_URL);
  const a = s.send(JPEG_URL); // frappe : photo inchangée
  assert.equal(a.patch, PHOTO_UNCHANGED);
  const b = s.send(null); // suppression avant la réponse de A
  assert.equal(b.patch, null);
  const ra = s.process(a);
  const rb = s.process(b);
  s.receive(ra);
  s.receive(rb);
  assert.equal(s.db.photo, null);
  assert.equal(s.tracker.confirmed, null);
  const c = s.send(null);
  assert.equal(c.patch, PHOTO_UNCHANGED);
  s.receive(s.process(c));
  assert.equal(s.db.photo, null);
});

test("échec d'une sauvegarde : la photo est renvoyée à la suivante", () => {
  const s = simulate(null);
  s.send(JPEG_URL); // échoue : jamais confirmée
  const b = s.send(JPEG_URL);
  assert.equal(b.patch, JPEG_URL);
  s.receive(s.process(b));
  assert.equal(s.db.photo, JPEG_URL);
});

test("photo refusée par le serveur : l'éditeur la sait absente et ne l'envoie plus comme « inchangée »", () => {
  const s = simulate(null);
  const a = s.send(WEBP_URL);
  const ra = s.process(a);
  assert.equal(ra.saved, null);
  s.receive(ra);
  assert.equal(s.tracker.confirmed, null);
  assert.equal(s.tracker.patch(WEBP_URL), WEBP_URL);
});

test("modèles avec photo : les 8 qui la dessinent ; Minimaliste, Classique et serif-centre n'en ont pas", () => {
  assert.deepEqual(
    CV_TEMPLATE_IDS.filter((id) => !templateHasPhoto(id)),
    ["minimaliste", "classique", "serif-centre"],
  );
  assert.equal(PHOTO_TEMPLATES.length, 8);
});
